// ============================================================
// GET /api/properties
//
// Performance strategy (fastest to slowest):
//  1. Module-level memory cache   — serves in <1ms, TTL 5 min
//  2. MySQL DB cache              — serves in <20ms, TTL 24h
//  3. HyperGuest hotels.json      — fallback, only on cold start
//     or manual refresh (?refresh=1)
//
// Supports server-side pagination + filtering:
//   ?page=1&pageSize=25&search=...&status=...&country=...&sort=name
//
// Background sync:
//   If DB data is >6h old, serves it immediately then refreshes
//   from HyperGuest in the background without blocking response.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getPool } from '@/db/connection'
import { API_TOKENS, BASE_URLS } from '@/lib/api/client'
import type { PropertyListItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ── Module-level memory cache ─────────────────────────────────────────────────
interface MemEntry<T> { data: T; expiresAt: number }
const memCache = new Map<string, MemEntry<unknown>>()
const MEM_TTL    = 5  * 60 * 1000  // 5 min
const DB_TTL_H   = 24              // hours — DB rows within this age served directly
const SYNC_AGE_H = 6               // hours — older than this triggers background refresh
const PAGE_SIZE_DEFAULT = 25
const PAGE_SIZE_MAX     = 500      // for export

function memGet<T>(key: string): T | null {
  const e = memCache.get(key)
  if (e && e.expiresAt > Date.now()) return e.data as T
  memCache.delete(key)
  return null
}
function memSet(key: string, data: unknown, ttl = MEM_TTL) {
  memCache.set(key, { data, expiresAt: Date.now() + ttl })
}
function bustMemCache() {
  for (const k of memCache.keys()) {
    if (k.startsWith('props:') || k.startsWith('countries:')) memCache.delete(k)
  }
}

// ── Bulk upsert (batched INSERT … ON DUPLICATE KEY UPDATE) ────────────────────
const UPSERT_BATCH = 200

async function bulkUpsertBasic(props: PropertyListItem[]): Promise<void> {
  if (props.length === 0) return
  const pool = await getPool()
  if (!pool) return

  for (let i = 0; i < props.length; i += UPSERT_BATCH) {
    const batch = props.slice(i, i + UPSERT_BATCH)
    const ph = batch.map(() => '(?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())').join(',')
    const vals: unknown[] = []
    for (const p of batch) {
      vals.push(p.id, p.name ?? '', p.rating ?? 0, p.status ?? '',
                p.countryCode ?? '', p.city ?? '', p.currency ?? '',
                p.checkIn ?? '', p.checkOut ?? '')
    }
    try {
      await pool.execute(
        `INSERT INTO hg_properties
           (id,name,rating,status,countryCode,city,currency,checkIn,checkOut,basicSyncedAt,syncedAt)
         VALUES ${ph}
         ON DUPLICATE KEY UPDATE
           name=VALUES(name), rating=VALUES(rating), status=VALUES(status),
           countryCode=VALUES(countryCode), city=VALUES(city), currency=VALUES(currency),
           checkIn=VALUES(checkIn), checkOut=VALUES(checkOut),
           basicSyncedAt=UTC_TIMESTAMP(), syncedAt=UTC_TIMESTAMP()`,
        vals
      )
    } catch { /* non-fatal */ }
  }
}

// ── Fetch from HyperGuest ─────────────────────────────────────────────────────
async function fetchFromHyperGuest(): Promise<PropertyListItem[]> {
  const res = await axios.get<unknown[]>(`${BASE_URLS.STATIC}/hotels.json`, {
    headers: { Authorization: `Bearer ${API_TOKENS.STATIC_TOKEN}`, Accept: 'application/json' },
    timeout: 30000,
    decompress: true,
  })
  const raw = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : []
  return raw.map((h) => ({
    id:          (h.hotel_id ?? h.id)          as number,
    name:        (h.name ?? '')                as string,
    rating:      h.rating                      as number | undefined,
    countryCode: (h.country ?? h.countryCode)  as string | undefined,
    city:        h.city                        as string | undefined,
    status:      h.status                      as string | undefined,
    currency:    h.currency                    as string | undefined,
    checkIn:     (h.checkIn ?? h.check_in)     as string | undefined,
    checkOut:    (h.checkOut ?? h.check_out)   as string | undefined,
  }))
}

// ── DB query with server-side filter + pagination ─────────────────────────────
interface DbResult {
  rows: PropertyListItem[]
  total: number
  countries: string[]
  oldestSyncedAt: Date | null
}

async function queryFromDb(p: {
  page: number; pageSize: number; search: string
  status: string; country: string; sort: string
}): Promise<DbResult | null> {
  const pool = await getPool()
  if (!pool) return null

  // Build WHERE
  const conds: string[] = []
  const args: unknown[] = []
  if (p.search) {
    const q = `%${p.search}%`
    conds.push('(name LIKE ? OR city LIKE ? OR countryCode LIKE ? OR CAST(id AS CHAR)=?)')
    args.push(q, q, q, p.search)
  }
  if (p.status && p.status !== 'all') {
    conds.push('LOWER(COALESCE(status,""))=?')
    args.push(p.status.toLowerCase())
  }
  if (p.country && p.country !== 'all') {
    conds.push('countryCode=?')
    args.push(p.country)
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  const order =
    p.sort === 'rating' ? 'ORDER BY COALESCE(rating,0) DESC, name ASC' :
    p.sort === 'status' ? 'ORDER BY COALESCE(status,"") ASC, name ASC' :
    'ORDER BY name ASC'

  try {
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total, MIN(basicSyncedAt) AS oldestSync FROM hg_properties ${where}`,
      args
    ) as [Array<{ total: number; oldestSync: Date | null }>, unknown]

    const total = Number(countRows[0]?.total ?? 0)
    if (total === 0) return null

    const [rows] = await pool.execute(
      `SELECT id,name,rating,status,countryCode,city,currency,checkIn,checkOut
         FROM hg_properties ${where} ${order}
         LIMIT ? OFFSET ?`,
      [...args, p.pageSize, (p.page - 1) * p.pageSize]
    ) as [PropertyListItem[], unknown]

    // Countries list — cached separately at 10 min
    const ck = 'countries:all'
    let countries = memGet<string[]>(ck)
    if (!countries) {
      const [cr] = await pool.execute(
        `SELECT DISTINCT countryCode FROM hg_properties
          WHERE countryCode IS NOT NULL AND countryCode!='' ORDER BY countryCode`
      ) as [Array<{ countryCode: string }>, unknown]
      countries = cr.map((r) => r.countryCode)
      memSet(ck, countries, 10 * 60 * 1000)
    }

    return { rows, total, countries, oldestSyncedAt: countRows[0]?.oldestSync ?? null }
  } catch {
    return null
  }
}

async function getDbCount(): Promise<number> {
  const pool = await getPool()
  if (!pool) return 0
  try {
    const [r] = await pool.execute('SELECT COUNT(*) AS c FROM hg_properties') as [Array<{c:number}>, unknown]
    return Number(r[0]?.c ?? 0)
  } catch { return 0 }
}

// ── Background sync (non-blocking, singleton) ─────────────────────────────────
let syncInFlight = false
async function backgroundSync() {
  if (syncInFlight) return
  syncInFlight = true
  try {
    const props = await fetchFromHyperGuest()
    await bulkUpsertBasic(props)
    bustMemCache()
    console.info(`[properties] Background sync done — ${props.length} properties`)
  } catch (e) {
    console.warn('[properties] Background sync failed:', (e as Error).message)
  } finally {
    syncInFlight = false
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const page     = Math.max(1, parseInt(sp.get('page')     ?? '1', 10))
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(sp.get('pageSize') ?? String(PAGE_SIZE_DEFAULT), 10)))
  const search   = (sp.get('search')  ?? '').trim()
  const status   = (sp.get('status')  ?? 'all').trim()
  const country  = (sp.get('country') ?? 'all').trim()
  const sort     = (sp.get('sort')    ?? 'name').trim()
  const forceRefresh = sp.get('refresh') === '1'

  const cacheKey = `props:${page}:${pageSize}:${search}:${status}:${country}:${sort}`

  // ── 1. Memory cache ──────────────────────────────────────────────────────
  if (!forceRefresh) {
    const hit = memGet<{ data: PropertyListItem[]; meta: object }>(cacheKey)
    if (hit) return NextResponse.json({ success: true, ...hit })
  }

  // ── 2. DB cache ──────────────────────────────────────────────────────────
  if (!forceRefresh) {
    const db = await queryFromDb({ page, pageSize, search, status, country, sort })
    if (db) {
      const ageH = db.oldestSyncedAt
        ? (Date.now() - new Date(db.oldestSyncedAt).getTime()) / 3_600_000
        : Infinity

      // Trigger background refresh if data is ageing but still within TTL
      if (ageH > SYNC_AGE_H && ageH < DB_TTL_H) void backgroundSync()

      const meta = {
        total: db.total, page, pageSize,
        totalPages: Math.max(1, Math.ceil(db.total / pageSize)),
        countries: db.countries,
        fromCache: true,
        cachedAt: db.oldestSyncedAt?.toISOString() ?? null,
      }
      const payload = { data: db.rows, meta }
      memSet(cacheKey, payload)
      return NextResponse.json({ success: true, ...payload })
    }
  }

  // ── 3. HyperGuest fetch (cold start or ?refresh=1) ───────────────────────
  try {
    // If DB has stale data, serve it immediately and refresh in background
    if (!forceRefresh && (await getDbCount()) > 0) {
      void backgroundSync()
      const stale = await queryFromDb({ page, pageSize, search, status, country, sort })
      if (stale) {
        return NextResponse.json({
          success: true,
          data: stale.rows,
          meta: {
            total: stale.total, page, pageSize,
            totalPages: Math.max(1, Math.ceil(stale.total / pageSize)),
            countries: stale.countries,
            fromCache: true,
            cachedAt: stale.oldestSyncedAt?.toISOString() ?? null,
          },
        })
      }
    }

    // Truly empty DB — synchronous fetch
    const properties = await fetchFromHyperGuest()
    await bulkUpsertBasic(properties)
    bustMemCache()

    // Apply filters in JS (once only — next request uses DB)
    let list = [...properties]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q) ||
        p.countryCode?.toLowerCase().includes(q) || String(p.id).includes(search))
    }
    if (status !== 'all') list = list.filter((p) => (p.status ?? '').toLowerCase() === status)
    if (country !== 'all') list = list.filter((p) => p.countryCode === country)
    if (sort === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    else if (sort === 'status') list.sort((a, b) => (a.status ?? '').localeCompare(b.status ?? ''))
    else list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

    const countries = Array.from(new Set(properties.map((p) => p.countryCode).filter(Boolean))).sort() as string[]
    const total = list.length
    return NextResponse.json({
      success: true,
      data: list.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        total, page, pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        countries, fromCache: false,
        cachedAt: new Date().toISOString(),
      },
    })
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err)
      ? `External API error: ${err.response?.status} ${err.message}`
      : err instanceof Error ? err.message : 'Unknown error'
    console.error('[GET /api/properties]', msg)
    return NextResponse.json({ success: false, data: [], error: msg }, { status: 502 })
  }
}
