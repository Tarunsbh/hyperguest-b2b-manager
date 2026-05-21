// ============================================================
// GET  /api/subscriptions/[id]  — fetch detail from HyperGuest PDM
// DELETE /api/subscriptions/[id] — unsubscribe HG (best-effort) + delete from DB
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { execute } from '@/db/connection';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { success: false, data: null, error: 'Subscription ID is required' },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get(
      `${BASE_URLS.PDM}/api/pdm/subscriptions/${id}/getSubscriptionDetails`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `PDM API error: ${err.response?.status} ${err.message}`
      : err instanceof Error
      ? err.message
      : 'Unknown error';

    console.error(`[GET /api/subscriptions/${id}]`, message);

    const status = axios.isAxiosError(err) && err.response?.status === 404 ? 404 : 502;

    return NextResponse.json(
      { success: false, data: null, error: message },
      { status }
    );
  }
}

// ── DELETE — hard delete: unsubscribe from HG (best-effort) + remove from DB ──
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Subscription ID required' }, { status: 400 });
  }

  // 1. Try to unsubscribe from HyperGuest — ignore errors (not found = already gone)
  try {
    await axios.get(
      `${BASE_URLS.PDM}/api/pdm/subscriptions/${id}/unsubscribe`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 20000,
      }
    );
  } catch (err) {
    // Non-fatal — HG may already have deleted it or never knew about it
    const msg = axios.isAxiosError(err)
      ? `${err.response?.status}: ${JSON.stringify(err.response?.data)}`
      : (err as Error).message;
    console.warn(`[DELETE /api/subscriptions/${id}] HG unsubscribe skipped: ${msg}`);
  }

  // 2. Delete from local DB
  try {
    await execute(
      `DELETE FROM hg_subscriptions WHERE subscriptionId = :subscriptionId`,
      { subscriptionId: id }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'DB error';
    console.error(`[DELETE /api/subscriptions/${id}] DB delete failed: ${msg}`);
    return NextResponse.json({ success: false, error: `DB delete failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Subscription ${id} deleted` });
}
