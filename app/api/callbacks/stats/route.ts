// ============================================================
// GET /api/callbacks/stats
// Returns ARI callback statistics from MySQL.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/connection';

export const dynamic = 'force-dynamic';

interface CountRow { total: number }
interface DateRow { callbackDate: string; count: number }

export async function GET(_request: NextRequest) {
  try {
    const [
      totalRows,
      processedRows,
      unprocessedRows,
      todayRows,
      byDateRows,
    ] = await Promise.all([
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_callbacks`),
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_callbacks WHERE processed = 1`),
      query<CountRow>(`SELECT COUNT(*) AS total FROM hg_callbacks WHERE processed = 0`),
      query<CountRow>(
        `SELECT COUNT(*) AS total FROM hg_callbacks WHERE DATE(receivedAt) = DATE(UTC_TIMESTAMP())`
      ),
      query<DateRow>(
        `
        SELECT
          DATE_FORMAT(receivedAt, '%Y-%m-%d') AS callbackDate,
          COUNT(*) AS count
        FROM hg_callbacks
        WHERE receivedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
        GROUP BY DATE_FORMAT(receivedAt, '%Y-%m-%d')
        ORDER BY callbackDate ASC
        `
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total: totalRows[0]?.total ?? 0,
        unprocessed: unprocessedRows[0]?.total ?? 0,
        processedToday: processedRows[0]?.total ?? 0,
        receivedToday: todayRows[0]?.total ?? 0,
        byDate: byDateRows,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/callbacks/stats]', message);

    return NextResponse.json({
      success: false,
      data: {
        total: 0,
        unprocessed: 0,
        processedToday: 0,
        receivedToday: 0,
        byDate: [],
      },
      error: message,
    });
  }
}
