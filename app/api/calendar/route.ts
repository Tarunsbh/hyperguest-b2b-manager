// ============================================================
// POST /api/calendar
// Body: { propertyId, roomCode, rateplanCode, startDate, endDate }
// Proxies to HyperGuest Calendar API. Returns CalendarDay[].
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';
import type { CalendarDay } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { propertyId, roomCode, rateplanCode, startDate, endDate } = body as {
    propertyId?: unknown;
    roomCode?: unknown;
    rateplanCode?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  };

  if (!propertyId || !roomCode || !rateplanCode || !startDate || !endDate) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Required fields: propertyId, roomCode, rateplanCode, startDate, endDate',
      },
      { status: 400 }
    );
  }

  try {
    const response = await axios.post<CalendarDay[]>(
      `${BASE_URLS.SEARCH}/calendar`,
      { propertyId, roomCode, rateplanCode, startDate, endDate },
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    const days: CalendarDay[] = Array.isArray(response.data) ? response.data : [];

    return NextResponse.json({
      success: true,
      data: days,
      message: `Fetched ${days.length} calendar days`,
    });
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `Calendar API error: ${err.response?.status} ${err.message}`
      : err instanceof Error
      ? err.message
      : 'Unknown error';

    console.error('[POST /api/calendar]', message);

    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 502 }
    );
  }
}
