// ============================================================
// GET /api/dashboard
// Aggregates stats, trends, and recent activity from MySQL.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/connection';
import { BASE_URLS, API_TOKENS } from '@/lib/api/client';
import type { DashboardStats, BookingTrendItem, SubscriptionStatusItem, StoredBooking, StoredCallback } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface CountRow    { total: number }
interface RateRow     { total: number; successful: number }
interface TrendRow    { bookingDate: string; count: number; amount: number }
interface StatusRow   { status: string; count: number }

async function probeEndpoint(url: string): Promise<'ok' | 'error'> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { Authorization: `Bearer ${API_TOKENS.STATIC_TOKEN}` },
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res.status < 500 ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

export async function GET(_request: NextRequest) {
  try {
    const endpointDefs = [
      { name: 'Static API',  url: BASE_URLS.STATIC },
      { name: 'Search API',  url: BASE_URLS.SEARCH },
      { name: 'PDM API',     url: BASE_URLS.PDM },
      { name: 'Booking API', url: BASE_URLS.BOOK },
    ]

    const [
      propertiesRows,
      subscriptionsRows,
      bookingsRows,
      callbacksRows,
      bookingsTodayRows,
      callbacksTodayRows,
      trendRows,
      subStatusRows,
      recentBookingsRows,
      recentCallbacksRows,
      ...endpointStatuses
    ] = await Promise.all([
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_properties`),
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_subscriptions WHERE status IN ('active', 'enabled')`),
      query<RateRow>(`SELECT COUNT(*) AS total, SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successful FROM hg_bookings`),
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_callbacks`),
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_bookings WHERE DATE(createdAt) = DATE(UTC_TIMESTAMP())`),
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_callbacks WHERE DATE(receivedAt) = DATE(UTC_TIMESTAMP())`),

      // Booking trend: last 30 days
      query<TrendRow>(`
        SELECT
          DATE_FORMAT(createdAt, '%Y-%m-%d') AS bookingDate,
          COUNT(*) AS count,
          IFNULL(SUM(totalAmount), 0) AS amount
        FROM hg_bookings
        WHERE createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
        ORDER BY bookingDate ASC
      `),

      // Subscription status distribution
      query<StatusRow>(`
        SELECT status, COUNT(*) AS count
        FROM hg_subscriptions
        GROUP BY status
      `),

      // Recent bookings (last 5)
      query<StoredBooking>(`
        SELECT * FROM hg_bookings ORDER BY createdAt DESC LIMIT 5
      `),

      // Recent callbacks (last 5)
      query<StoredCallback>(`
        SELECT * FROM hg_callbacks ORDER BY receivedAt DESC LIMIT 5
      `),
      ...endpointDefs.map((ep) => probeEndpoint(ep.url)),
    ]);

    const totalBookings   = bookingsRows[0]?.total ?? 0;
    const successBookings = bookingsRows[0]?.successful ?? 0;
    const successRate     = totalBookings > 0
      ? Math.round((successBookings / totalBookings) * 100 * 10) / 10
      : 0;

    const stats: DashboardStats = {
      totalProperties:    propertiesRows[0]?.total ?? 0,
      activeSubscriptions: subscriptionsRows[0]?.total ?? 0,
      totalBookingsPushed: totalBookings,
      totalARICallbacks:  callbacksRows[0]?.total ?? 0,
      bookingsToday:      bookingsTodayRows[0]?.total ?? 0,
      callbacksToday:     callbacksTodayRows[0]?.total ?? 0,
      successRate,
    };

    const bookingTrend: BookingTrendItem[] = trendRows.map((r) => ({
      date:     r.bookingDate,
      bookings: r.count,
      amount:   r.amount,
    }));

    const subscriptionStatus: SubscriptionStatusItem[] = subStatusRows.map((r) => ({
      status: r.status,
      count:  r.count,
    }));

    const apiEndpoints = endpointDefs.map((ep, i) => ({
      name:   ep.name,
      url:    ep.url,
      status: endpointStatuses[i] as 'ok' | 'error',
    }));

    return NextResponse.json({
      success: true,
      data: {
        stats,
        bookingTrend,
        subscriptionStatus,
        recentBookings:  recentBookingsRows,
        recentCallbacks: recentCallbacksRows,
        apiEndpoints,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/dashboard]', message);

    const emptyStats: DashboardStats = {
      totalProperties: 0, activeSubscriptions: 0, totalBookingsPushed: 0,
      totalARICallbacks: 0, bookingsToday: 0, callbacksToday: 0, successRate: 0,
    };

    return NextResponse.json({
      success: false,
      data: {
        stats: emptyStats,
        bookingTrend: [],
        subscriptionStatus: [],
        recentBookings: [],
        recentCallbacks: [],
        apiEndpoints: [],
      },
      error: message,
    });
  }
}
