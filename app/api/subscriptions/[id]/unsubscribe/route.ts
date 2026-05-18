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

  try {
    // ---- Call PDM unsubscribe (GET per API spec) ----
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

    // ---- Update DB status to 'disabled' (best-effort) ----
    try {
      await execute(
        `
        UPDATE hg_subscriptions
        SET status = 'disabled', updatedAt = UTC_TIMESTAMP()
        WHERE subscriptionId = :subscriptionId
        `,
        { subscriptionId: id }
      );
    } catch {
      // DB write failure is non-fatal
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      message: `Subscription ${id} unsubscribed`,
    });
  } catch (err: unknown) {
    let message: string;
    if (axios.isAxiosError(err)) {
      const body = err.response?.data;
      const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : err.message;
      message = `PDM API error ${err.response?.status ?? ''}: ${bodyStr}`.trim();
    } else {
      message = err instanceof Error ? err.message : 'Unknown error';
    }

    console.error(`[POST /api/subscriptions/${id}/unsubscribe]`, message);

    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 502 }
    );
  }
}
