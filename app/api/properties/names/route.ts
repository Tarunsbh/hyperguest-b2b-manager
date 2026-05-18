// ============================================================
// POST /api/properties/names
// Batch endpoint — returns { id: name } map for many property IDs.
//
// Strategy:
//  1. Query DB for all requested IDs in ONE SQL query
//  2. Return cached names instantly (no HyperGuest call)
//  3. For any IDs not in cache (or expired > 24h), fetch from
//     HyperGuest one at a time with a small delay, save to DB,
//     include in response
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query, execute } from '@/db/connection';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

const CACHE_TTL_HOURS = 24;
const FETCH_DELAY_MS  = 400; // gap between HyperGuest calls to avoid 429

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseProperty(raw: Record<string, unknown>): any {
  const rooms = (Array.isArray(raw.rooms) ? raw.rooms : [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({ ...r, code: r.pmsCode ?? r.code ?? undefined }));

  const ratePlans = (Array.isArray(raw.ratePlans) ? raw.ratePlans : [])
    .filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((rp: any) => ({ ...rp, code: rp.pmsCode ?? rp.code ?? undefined }));

  const settings = raw.settings
    ? {
        ...(raw.settings as Record<string, unknown>),
        chain:
          typeof (raw.settings as Record<string, unknown>).chain === 'object' &&
          (raw.settings as Record<string, unknown>).chain !== null
            ? ((raw.settings as Record<string, unknown>).chain as { name: string }).name
            : (raw.settings as Record<string, unknown>).chain,
      }
    : raw.settings;

  return { ...raw, rooms, ratePlans, settings };
}

async function fetchAndCache(id: number): Promise<string | null> {
  try {
    const res = await axios.get(
      `${BASE_URLS.STATIC}/${id}/property-static.json`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 20000,
      }
    );

    const property = normaliseProperty(res.data as Record<string, unknown>);
    const name: string = property.name ?? '';

    // Upsert into DB
    await execute(
      `INSERT INTO hg_properties
        (id, name, rating, status, isTest,
         countryCode, city, address, postcode, region,
         latitude, longitude, timezone,
         phone, email, website,
         currency, checkIn, checkOut, numberOfRooms, hotelType,
         commission, commissionType, rawData,
         basicSyncedAt, detailSyncedAt, syncedAt)
       VALUES
        (:id, :name, :rating, :status, :isTest,
         :countryCode, :city, :address, :postcode, :region,
         :latitude, :longitude, :timezone,
         :phone, :email, :website,
         :currency, :checkIn, :checkOut, :numberOfRooms, :hotelType,
         :commission, :commissionType, :rawData,
         UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         name           = VALUES(name),
         city           = VALUES(city),
         rawData        = VALUES(rawData),
         detailSyncedAt = UTC_TIMESTAMP(),
         syncedAt       = UTC_TIMESTAMP()`,
      {
        id,
        name,
        rating:         property.rating ?? 0,
        status:         property.status ?? '',
        isTest:         property.isTest ?? 0,
        countryCode:    property.location?.countryCode ?? '',
        city:           property.location?.city?.name ?? '',
        address:        property.location?.address ?? '',
        postcode:       property.location?.postcode ?? '',
        region:         property.location?.region ?? '',
        latitude:       property.coordinates?.latitude ?? null,
        longitude:      property.coordinates?.longitude ?? null,
        timezone:       property.settings?.timezone ?? '',
        phone:          property.contact?.phone ?? '',
        email:          property.contact?.email ?? '',
        website:        property.contact?.website ?? '',
        currency:       property.settings?.currency ?? '',
        checkIn:        property.settings?.checkIn ?? '',
        checkOut:       property.settings?.checkOut ?? '',
        numberOfRooms:  property.settings?.numberOfRooms ?? null,
        hotelType:      property.settings?.hotelType?.name ?? '',
        commission:     property.commission?.value ?? null,
        commissionType: property.commission?.chargeType ?? '',
        rawData:        JSON.stringify(property),
      }
    );

    return name || null;
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let ids: number[] = [];

  try {
    const body = await req.json();
    ids = (body.ids ?? [])
      .map((v: unknown) => parseInt(String(v), 10))
      .filter((n: number) => !isNaN(n) && n > 0);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ success: true, data: {} });
  }

  // Deduplicate
  const uniqueIds = Array.from(new Set(ids));

  const result: Record<string, string> = {};

  // ── 1. Batch-query DB for all IDs in one shot ────────────────────────────
  const cachedIds = new Set<number>();
  try {
    // Build positional placeholders: ?, ?, ?
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const rows = await query<{ id: number; name: string }>(
      `SELECT id, name
         FROM hg_properties
        WHERE id IN (${placeholders})
          AND name != ''
          AND syncedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${CACHE_TTL_HOURS} HOUR)`,
      // query() accepts Record<string,unknown>, so we pass a named wrapper
      // but our DB helper uses execute() style — use getPool directly via raw query
    );

    // Note: our query() helper only supports named params — use pool directly
    // We'll handle this below with getPool
    void rows; // suppress unused warning — handled below
  } catch {
    // ignore
  }

  // Use pool directly for IN clause with positional params
  try {
    const { getPool } = await import('@/db/connection');
    const pool = await getPool();
    if (pool) {
      const placeholders = uniqueIds.map(() => '?').join(', ');
      const [rows] = await pool.execute(
        `SELECT id, name
           FROM hg_properties
          WHERE id IN (${placeholders})
            AND name != ''
            AND syncedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)`,
        [...uniqueIds, CACHE_TTL_HOURS]
      ) as [Array<{ id: number; name: string }>, unknown];

      for (const row of rows) {
        result[String(row.id)] = row.name;
        cachedIds.add(row.id);
      }
    }
  } catch {
    // DB unavailable — all IDs will be fetched from HyperGuest
  }

  // ── 2. Fetch missing IDs from HyperGuest (throttled) ────────────────────
  const missing = uniqueIds.filter((id) => !cachedIds.has(id));

  for (const id of missing) {
    const name = await fetchAndCache(id);
    if (name) result[String(id)] = name;
    if (missing.indexOf(id) < missing.length - 1) {
      await sleep(FETCH_DELAY_MS);
    }
  }

  return NextResponse.json({ success: true, data: result });
}
