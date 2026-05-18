// ============================================================
// GET /api/search?checkIn=&nights=&guests=&hotelIds=&customerNationality=
// Proxies to HyperGuest Search API 2.0.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const checkIn = searchParams.get('checkIn');
  const nights = searchParams.get('nights');
  const guests = searchParams.get('guests');
  const hotelIds = searchParams.get('hotelIds');
  const customerNationality = searchParams.get('customerNationality');

  if (!checkIn || !nights || !guests || !hotelIds) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Required query params: checkIn, nights, guests, hotelIds',
      },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get(`${BASE_URLS.SEARCH}/2.0`, {
      headers: {
        Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
        Accept: 'application/json',
      },
      params: {
        checkIn,
        nights,
        guests,
        hotelIds,
        ...(customerNationality ? { customerNationality } : {}),
      },
      timeout: 30000,
    });

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `Search API error: ${err.response?.status} ${err.message}`
      : err instanceof Error
      ? err.message
      : 'Unknown error';

    console.error('[GET /api/search]', message);

    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 502 }
    );
  }
}
