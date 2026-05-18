// ============================================================
// GET  /api/bookings  — Paginated list from MySQL with filters
// POST /api/bookings  — Send OTA SOAP booking to HyperGuest
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query, execute } from '@/db/connection';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';
import { buildOtaXml, generateReservationId } from '@/lib/api/bookings';
import type { BookingPushRequest, StoredBooking } from '@/lib/types';

export const dynamic = 'force-dynamic';

// -------------------- GET --------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const status = searchParams.get('status');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const search = searchParams.get('search');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;

  // Build WHERE clauses
  const conditions: string[] = [];
  const filterParams: Record<string, unknown> = {};

  if (status) {
    conditions.push('resStatus = :status');
    filterParams.status = status;
  }
  if (dateFrom) {
    conditions.push('checkIn >= :dateFrom');
    filterParams.dateFrom = dateFrom;
  }
  if (dateTo) {
    conditions.push('checkIn <= :dateTo');
    filterParams.dateTo = dateTo;
  }
  if (search) {
    conditions.push(
      '(reservationId LIKE :search OR guestName LIKE :search OR guestEmail LIKE :search OR hotelCode LIKE :search)'
    );
    filterParams.search = `%${search}%`;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const rows = await query<StoredBooking>(
      `SELECT * FROM hg_bookings ${where} ORDER BY createdAt DESC LIMIT :pageSize OFFSET :offset`,
      { ...filterParams, pageSize, offset }
    );

    interface CountRow { total: number }
    const countRows = await query<CountRow>(
      `SELECT COUNT(*) AS total FROM hg_bookings ${where}`,
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
    console.error('[GET /api/bookings]', message);
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    );
  }
}

// -------------------- POST --------------------
export async function POST(request: NextRequest) {
  let body: Partial<BookingPushRequest>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body.hotelCode || !body.rooms || !body.guest) {
    return NextResponse.json(
      { success: false, data: null, error: 'Required fields: hotelCode, rooms, guest' },
      { status: 400 }
    );
  }

  const bookingReq: BookingPushRequest = {
    reservationId: body.reservationId || generateReservationId(),
    hotelCode: body.hotelCode,
    resStatus: (body.resStatus === 'Committed' ? 'Commit' : body.resStatus) || 'Commit',
    echoToken: body.echoToken || Date.now().toString(36),
    rooms: body.rooms,
    guest: body.guest,
    totalAmountBeforeTax: body.totalAmountBeforeTax ?? 0,
    totalAmountAfterTax: body.totalAmountAfterTax ?? 0,
    currency: body.currency || 'USD',
    timestamp: body.timestamp || new Date().toISOString(),
  };

  // ---- Build OTA XML ----
  const xml = buildOtaXml(bookingReq);

  let rawResponse = '';
  let success = false;

  try {
    // ---- POST to HyperGuest Booking API (no auth required per API spec) ----
    const response = await axios.post<string>(
      `${BASE_URLS.BOOK}/envelope/booking/OTA/reservation`,
      xml,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'OTA_HotelResNotifRQ',
          Accept: 'text/xml, application/xml, */*',
        },
        timeout: 30000,
      }
    );

    rawResponse =
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    success = true;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data;
      const bodyStr = body
        ? typeof body === 'string' ? body : JSON.stringify(body)
        : err.message;
      rawResponse = `HTTP ${err.response?.status ?? ''}: ${bodyStr}`.trim();
    } else {
      rawResponse = err instanceof Error ? err.message : 'Unknown error';
    }
    success = false;
  }

  // ---- Persist to MySQL (best-effort) ----
  const g = bookingReq.guest;
  const firstRoom = bookingReq.rooms[0];
  try {
    await execute(
      `
      INSERT INTO hg_bookings
        (reservationId, hotelCode, resStatus, checkIn, checkOut,
         guestName, guestEmail, rooms, totalAmount, currency,
         xmlPayload, response, success, createdAt)
      VALUES
        (:reservationId, :hotelCode, :resStatus, :checkIn, :checkOut,
         :guestName, :guestEmail, :rooms, :totalAmount, :currency,
         :xmlPayload, :response, :success, UTC_TIMESTAMP())
      `,
      {
        reservationId: bookingReq.reservationId,
        hotelCode: bookingReq.hotelCode,
        resStatus: bookingReq.resStatus,
        checkIn: firstRoom?.checkIn ?? '',
        checkOut: firstRoom?.checkOut ?? '',
        guestName: `${g.firstName} ${g.lastName}`,
        guestEmail: g.email,
        rooms: bookingReq.rooms.length,
        totalAmount: bookingReq.totalAmountAfterTax,
        currency: bookingReq.currency,
        xmlPayload: xml,
        response: rawResponse,
        success: success ? 1 : 0,
      }
    );
  } catch {
    // DB write failure is non-fatal
  }

  if (!success) {
    return NextResponse.json(
      {
        success: false,
        data: {
          reservationId: bookingReq.reservationId,
          status: 'Failed',
          rawResponse,
        },
        error: rawResponse,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      reservationId: bookingReq.reservationId,
      status: 'Committed',
      rawResponse,
    },
    message: 'Booking pushed successfully',
  });
}
