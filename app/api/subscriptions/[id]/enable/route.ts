// ============================================================
// POST /api/subscriptions/[id]/enable
// Calls HyperGuest PDM enableSubscription (Bearer STATIC_TOKEN),
// updates DB status to 'enabled'.
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

  try {
    // ---- Call PDM enableSubscription ----
    const response = await axios.get(
      `${BASE_URLS.PDM}/api/pdm/subscriptions/${id}/enableSubscription`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    // ---- Update DB status to 'enabled' ----
    try {
      await execute(
        `UPDATE hg_subscriptions
            SET status = 'enabled', updatedAt = UTC_TIMESTAMP()
          WHERE subscriptionId = :subscriptionId`,
        { subscriptionId: id }
      );
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      data: response.data,
      message: `Subscription ${id} enabled`,
    });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data;
      const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : err.message;

      // If HyperGuest says "not found", the subscription no longer exists on their side.
      // It cannot be re-enabled — surface a clear, actionable message.
      const isNotFound =
        err.response?.status === 404 ||
        bodyStr.toLowerCase().includes('not found') ||
        bodyStr.includes('PDM.404') ||
        bodyStr.includes('PDM.500');

      if (isNotFound) {
        const friendlyMsg =
          `Subscription not found in HyperGuest — it may have been deleted on their side. ` +
          `Please delete this subscription locally and create a new one.`;
        console.warn(`[POST /api/subscriptions/${id}/enable] HG not found`);
        return NextResponse.json({ success: false, data: null, error: friendlyMsg }, { status: 404 });
      }

      const message = `PDM API error ${err.response?.status ?? ''}: ${bodyStr}`.trim();
      console.error(`[POST /api/subscriptions/${id}/enable]`, message);
      return NextResponse.json({ success: false, data: null, error: message }, { status: 502 });
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[POST /api/subscriptions/${id}/enable]`, message);
    return NextResponse.json({ success: false, data: null, error: message }, { status: 502 });
  }
}
