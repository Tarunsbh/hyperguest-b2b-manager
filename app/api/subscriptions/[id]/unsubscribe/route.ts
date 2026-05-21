// ============================================================
// POST /api/subscriptions/[id]/unsubscribe
// Calls HyperGuest PDM unsubscribe, updates DB status to 'disabled'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { execute } from '@/db/connection';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

export async function POST(
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

  // Helper: update DB status regardless of HyperGuest outcome
  const updateDbStatus = async (status: 'disabled') => {
    try {
      await execute(
        `UPDATE hg_subscriptions
            SET status = :status, updatedAt = UTC_TIMESTAMP()
          WHERE subscriptionId = :subscriptionId`,
        { status, subscriptionId: id }
      );
    } catch { /* non-fatal */ }
  };

  try {
    // ---- Call PDM unsubscribe ----
    const response = await axios.get(
      `${BASE_URLS.PDM}/api/pdm/subscriptions/${id}/unsubscribe`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    await updateDbStatus('disabled');

    return NextResponse.json({
      success: true,
      data: response.data,
      message: `Subscription ${id} unsubscribed`,
    });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data;
      const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : err.message;

      // If HyperGuest says "not found" the subscription is already gone on their side.
      // Treat it as success and sync our local DB.
      const isNotFound =
        err.response?.status === 404 ||
        bodyStr.toLowerCase().includes('not found') ||
        bodyStr.includes('PDM.404') ||
        bodyStr.includes('PDM.500');

      if (isNotFound) {
        console.warn(`[POST /api/subscriptions/${id}/unsubscribe] HG not found — marking disabled in DB`);
        await updateDbStatus('disabled');
        return NextResponse.json({
          success: true,
          data: null,
          message: `Subscription ${id} was not found in HyperGuest — marked as disabled locally.`,
        });
      }

      const message = `PDM API error ${err.response?.status ?? ''}: ${bodyStr}`.trim();
      console.error(`[POST /api/subscriptions/${id}/unsubscribe]`, message);
      return NextResponse.json({ success: false, data: null, error: message }, { status: 502 });
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[POST /api/subscriptions/${id}/unsubscribe]`, message);
    return NextResponse.json({ success: false, data: null, error: message }, { status: 502 });
  }
}
