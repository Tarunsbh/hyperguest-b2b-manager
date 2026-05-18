// ============================================================
// GET /api/facilities
// Fetches the facilities reference list from HyperGuest.
// Cached with Cache-Control: public, max-age=86400 (24h).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';
import type { Facility } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const response = await axios.get<Facility[]>(
      `${BASE_URLS.STATIC}/facilities.json`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    const facilities: Facility[] = Array.isArray(response.data)
      ? response.data
      : [];

    return NextResponse.json(
      {
        success: true,
        data: facilities,
        message: `Fetched ${facilities.length} facilities`,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        },
      }
    );
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `External API error: ${err.response?.status} ${err.message}`
      : err instanceof Error
      ? err.message
      : 'Unknown error';

    console.error('[GET /api/facilities]', message);

    return NextResponse.json(
      { success: false, data: [], error: message },
      { status: 502 }
    );
  }
}
