import { NextResponse } from 'next/server'

/**
 * GET /api/health
 * Used by Docker / load-balancer health checks.
 */
export async function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { status: 200 }
  )
}
