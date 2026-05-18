// ============================================================
// GET /api/subscriptions/list
// Calls https://pdm.hyperguest.io/api/pdm/subscriptions/list
// Returns all subscriptions for the authenticated user.
// Also merges with locally stored subscriptions from MySQL.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';
import { query } from '@/db/connection';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || '';
  const status  = searchParams.get('status') || '';

  try {
    // ── 1. Call HyperGuest PDM subscriptions/list ──────────
    let pdmSubscriptions: unknown[] = [];
    try {
      const pdmRes = await axios.get(
        `${BASE_URLS.PDM}/api/pdm/subscriptions/list`,
        {
          headers: {
            Authorization: `Bearer ${API_TOKENS.STATIC_TOKEN}`,
            'Content-Type': 'application/json',
          },
          params: {
            ...(userId ? { userId } : {}),
            ...(status  ? { status  } : {}),
          },
          timeout: 15000,
        }
      );
      pdmSubscriptions = Array.isArray(pdmRes.data)
        ? pdmRes.data
        : (pdmRes.data?.subscriptions ?? pdmRes.data?.items ?? []);
    } catch (pdmErr) {
      // PDM list might not be available — fall through to DB only
      console.warn('[subscriptions/list] PDM list call failed:',
        axios.isAxiosError(pdmErr) ? pdmErr.message : String(pdmErr));
    }

    // ── 2. Also load from local MySQL (if available) ────────
    const dbRows = await query<{
      subscriptionId: string;
      userId: string;
      propertyIds: string;
      method: string;
      envelope: string;
      status: string;
      version: number;
      email: string;
      callbackUrl: string;
      createdAt: string;
      updatedAt: string;
    }>(`SELECT * FROM hg_subscriptions ORDER BY createdAt DESC`);

    // ── 3. Merge: PDM data takes precedence; DB fills gaps ──
    const pdmMap = new Map<string, unknown>();
    for (const sub of pdmSubscriptions) {
      const s = sub as Record<string, unknown>;
      if (s.subscriptionId) pdmMap.set(s.subscriptionId as string, s);
    }

    const merged = [
      // First: all PDM subscriptions (live data)
      ...pdmSubscriptions,
      // Then: DB-only rows that PDM didn't return (archived / offline)
      ...dbRows
        .filter(row => !pdmMap.has(row.subscriptionId))
        .map(row => ({
          subscriptionId: row.subscriptionId,
          userId: row.userId,
          propertyIds: (() => {
            try { return JSON.parse(row.propertyIds); } catch { return []; }
          })(),
          method: row.method,
          envelope: row.envelope,
          status: row.status,
          version: row.version,
          email: row.email,
          callbackUrl: row.callbackUrl,
          createdAt: row.createdAt,
          source: 'local',
        })),
    ];

    return NextResponse.json({
      success: true,
      data: merged,
      total: merged.length,
      source: pdmSubscriptions.length > 0 ? 'pdm+local' : 'local',
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[subscriptions/list] Error:', msg);
    return NextResponse.json(
      { success: false, data: [], total: 0, error: msg },
      { status: 500 }
    );
  }
}
