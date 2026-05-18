// ============================================================
// GET /api/bookings/stats
// Returns booking statistics from MySQL.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/connection';

export const dynamic = 'force-dynamic';

interface CountRow { total: number }
interface AmountRow { total: number }
interface StatusRow { resStatus: string; count: number }
interface DateRow { bookingDate: string; count: number; amount: number }

export async function GET(_request: NextRequest) {
  try {
    const [
      totalRows,
      successRows,
      failedRows,
      todayRows,
      amountRows,
      byStatusRows,
      byDateRows,
    ] = await Promise.all([
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_bookings`),
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_bookings WHERE success = 1`),
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_bookings WHERE success = 0`),
      query<CountRow>(
        `SELECT COUNT(*) AS total FROM hg_bookings WHERE DATE(createdAt) = DATE(UTC_TIMESTAMP())`
      ),
      query<AmountRow>(`SELECT IFNULL(SUM(totalAmount), 0) AS total FROM hg_bookings WHERE success = 1`),
      query<StatusRow>(
        `SELECT resStatus, COUNT(*) AS count FROM hg_bookings GROUP BY resStatus ORDER BY count DESC`
      ),
      query<DateRow>(
        `
        SELECT
          DATE_FORMAT(createdAt, '%Y-%m-%d') AS bookingDate,
          COUNT(*) AS count,
          IFNULL(SUM(totalAmount), 0) AS amount
        FROM hg_bookings
        WHERE createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
        ORDER BY bookingDate ASC
        `
      ),
    ]);

    const total = totalRows[0]?.total ?? 0;
    const successful = successRows[0]?.total ?? 0;
    const failed = failedRows[0]?.total ?? 0;
    const today = todayRows[0]?.total ?? 0;
    const totalAmount = amountRows[0]?.total ?? 0;
    const successRate = total > 0 ? Math.round((successful / total) * 1000) / 10 : 0;

    return NextResponse.json({
      success: true,
      data: {
        total,
        successful,
        failed,
        today,
        successRate,
        totalAmount,
        currency: 'USD',
        bookingsByStatus: byStatusRows,
        bookingsByDate: byDateRows,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/bookings/stats]', message);

    // Return zeroed stats rather than a hard error
    return NextResponse.json({
      success: false,
      data: {
        total: 0,
        successful: 0,
        failed: 0,
        today: 0,
        successRate: 0,
        totalAmount: 0,
        currency: 'USD',
        bookingsByStatus: [],
        bookingsByDate: [],
      },
      error: message,
    });
  }
}
