// ============================================================
// GET  /api/callbacks  — Paginated list from MySQL
// POST /api/callbacks  — Inbound ARI webhook from HyperGuest
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/db/connection';
import { API_TOKENS } from '@/lib/api/client';
import type { StoredCallback } from '@/lib/types';

export const dynamic = 'force-dynamic';

// -------------------- GET --------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const filterParams: Record<string, unknown> = {};

  if (status) {
    conditions.push('status = :status');
    filterParams.status = status;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const rows = await query<StoredCallback>(
      `SELECT * FROM hg_callbacks ${where} ORDER BY receivedAt DESC LIMIT :pageSize OFFSET :offset`,
      { ...filterParams, pageSize, offset }
    );

    interface CountRow { total: number }
    const countRows = await query<CountRow>(
      `SELECT COUNT(*) AS total FROM hg_callbacks ${where}`,
      filterParams
    );
    const total = countRows[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        items: rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/callbacks]', message);
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    );
  }
}

// -------------------- POST (inbound webhook) --------------------
export async function POST(request: NextRequest) {
  // ---- Validate Bearer token ----
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (token !== API_TOKENS.CALLBACK_TOKEN) {
    return NextResponse.json(
      { success: false, data: null, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let payload: unknown;
  let payloadStr: string;

  try {
    payloadStr = await request.text();
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      payload = payloadStr;
    }
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Could not read request body' },
      { status: 400 }
    );
  }

  // Try to extract propertyId from payload
  const propertyId =
    typeof payload === 'object' && payload !== null && 'propertyId' in payload
      ? (payload as Record<string, unknown>).propertyId
      : null;

  const now = new Date().toISOString();

  // ---- Persist to MySQL (best-effort) ----
  try {
    await execute(
      `
      INSERT INTO hg_callbacks (receivedAt, payload, propertyId, status, processed)
      VALUES (:receivedAt, :payload, :propertyId, :status, :processed)
      `,
      {
        receivedAt: now,
        payload: typeof payloadStr === 'string' ? payloadStr : JSON.stringify(payload),
        propertyId: propertyId ?? null,
        status: 'received',
        processed: 0,
      }
    );
  } catch {
    // DB write failure is non-fatal — still return 200 to HyperGuest
  }

  return NextResponse.json({
    success: true,
    data: { receivedAt: now },
    message: 'Callback received',
  });
}
