// ============================================================
// GET /api/subscriptions/[id]
// Fetch subscription detail from HyperGuest PDM API.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
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
