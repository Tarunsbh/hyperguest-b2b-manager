// ============================================================
// GET /api/properties
// 1. Fetches the hotel list from HyperGuest Static API
// 2. Upserts basic data for every property immediately
// 3. Background-syncs full detail (contact, address, coords)
//    for properties that have never been detail-synced, or
//    whose detail is older than 24 hours — concurrency 5.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { execute, query } from '@/db/connection';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';
import type { PropertyListItem, PropertyDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchPropertyDetail(id: number): Promise<PropertyDetail | null> {
  try {
    const res = await axios.get<PropertyDetail>(
      `${BASE_URLS.STATIC}/${id}/property-static.json`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    )
    return res.data ?? null
  } catch {
    return null
  }
}

async function savePropertyDetail(prop: PropertyDetail): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = prop as any
  const settings = raw.settings ?? {}
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
       rating         = VALUES(rating),
       status         = VALUES(status),
       isTest         = VALUES(isTest),
       countryCode    = VALUES(countryCode),
       city           = VALUES(city),
       address        = VALUES(address),
       postcode       = VALUES(postcode),
       region         = VALUES(region),
       latitude       = VALUES(latitude),
       longitude      = VALUES(longitude),
       timezone       = VALUES(timezone),
       phone          = VALUES(phone),
       email          = VALUES(email),
       website        = VALUES(website),
       currency       = VALUES(currency),
       checkIn        = VALUES(checkIn),
       checkOut       = VALUES(checkOut),
       numberOfRooms  = VALUES(numberOfRooms),
       hotelType      = VALUES(hotelType),
       commission     = VALUES(commission),
       commissionType = VALUES(commissionType),
       rawData        = VALUES(rawData),
       detailSyncedAt = UTC_TIMESTAMP(),
       syncedAt       = UTC_TIMESTAMP()`,
    {
      id:             prop.id,
      name:           prop.name ?? '',
      rating:         prop.rating ?? 0,
      status:         prop.status ?? '',
      isTest:         prop.isTest ?? 0,
      countryCode:    prop.location?.countryCode ?? '',
      city:           prop.location?.city?.name ?? '',
      address:        prop.location?.address ?? '',
      postcode:       prop.location?.postcode ?? '',
      region:         prop.location?.region ?? '',
      latitude:       prop.coordinates?.latitude ?? null,
      longitude:      prop.coordinates?.longitude ?? null,
      timezone:       settings.timezone ?? '',
      phone:          prop.contact?.phone ?? '',
      email:          prop.contact?.email ?? '',
      website:        prop.contact?.website ?? '',
      currency:       settings.currency ?? '',
      checkIn:        settings.checkIn ?? '',
      checkOut:       settings.checkOut ?? '',
      numberOfRooms:  settings.numberOfRooms ?? null,
      hotelType:      settings.hotelType?.name ?? '',
      commission:     prop.commission?.value ?? null,
      commissionType: prop.commission?.chargeType ?? '',
      rawData:        JSON.stringify(prop),
    }
  )
}

/** Run async tasks with a concurrency limit. */
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!
      await fn(item).catch(() => { /* individual failure is non-fatal */ })
    }
  })
  await Promise.all(workers)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  try {
    // ── 1. Fetch basic list from HyperGuest ───────────────────────────────
    const response = await axios.get<unknown[]>(
      `${BASE_URLS.STATIC}/hotels.json`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.STATIC_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    )

    const raw: Record<string, unknown>[] = Array.isArray(response.data)
      ? (response.data as Record<string, unknown>[])
      : []

    const properties: PropertyListItem[] = raw.map((h) => ({
      id:          (h.hotel_id ?? h.id)            as number,
      name:        (h.name)                         as string,
      rating:      (h.rating)                       as number | undefined,
      countryCode: (h.country ?? h.countryCode)     as string | undefined,
      city:        (h.city)                         as string | undefined,
      status:      (h.status)                       as string | undefined,
      currency:    (h.currency)                     as string | undefined,
      checkIn:     (h.checkIn ?? h.check_in)        as string | undefined,
      checkOut:    (h.checkOut ?? h.check_out)      as string | undefined,
    }))

    // ── 2. Upsert basic data for all properties (fast) ────────────────────
    for (const prop of properties) {
      try {
        await execute(
          `INSERT INTO hg_properties
             (id, name, rating, status, countryCode, city, currency, checkIn, checkOut, basicSyncedAt, syncedAt)
           VALUES
             (:id, :name, :rating, :status, :countryCode, :city, :currency, :checkIn, :checkOut, UTC_TIMESTAMP(), UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE
             name        = VALUES(name),
             rating      = VALUES(rating),
             status      = VALUES(status),
             countryCode = VALUES(countryCode),
             city        = VALUES(city),
             currency    = VALUES(currency),
             checkIn     = VALUES(checkIn),
             checkOut    = VALUES(checkOut),
             basicSyncedAt = UTC_TIMESTAMP(),
             syncedAt    = UTC_TIMESTAMP()`,
          {
            id:          prop.id,
            name:        prop.name ?? '',
            rating:      prop.rating ?? 0,
            status:      prop.status ?? '',
            countryCode: prop.countryCode ?? '',
            city:        prop.city ?? '',
            currency:    prop.currency ?? '',
            checkIn:     prop.checkIn ?? '',
            checkOut:    prop.checkOut ?? '',
          }
        )
      } catch {
        // individual upsert failure is non-fatal
      }
    }

    // ── 3. Background: fetch + save full detail for stale/new properties ──
    // Runs after response is sent; does NOT block the client.
    void (async () => {
      try {
        // Find IDs that have never been detail-synced or synced > 24h ago
        interface StaleRow { id: number }
        const staleIds = await query<StaleRow>(
          `SELECT id FROM hg_properties
           WHERE detailSyncedAt IS NULL
              OR detailSyncedAt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
           ORDER BY detailSyncedAt ASC`
        )
        const ids = staleIds.map((r) => r.id)
        if (ids.length === 0) return

        await withConcurrency(ids, 5, async (id) => {
          const detail = await fetchPropertyDetail(id)
          if (detail) await savePropertyDetail(detail)
        })

        console.info(`[properties] Background sync complete for ${ids.length} properties`)
      } catch (err) {
        console.warn('[properties] Background detail sync error:', err)
      }
    })()

    return NextResponse.json({
      success: true,
      data: properties,
      message: `Fetched ${properties.length} properties`,
    })
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `External API error: ${err.response?.status} ${err.message}`
      : err instanceof Error
      ? err.message
      : 'Unknown error'

    console.error('[GET /api/properties]', message)

    return NextResponse.json(
      { success: false, data: [], error: message },
      { status: 502 }
    )
  }
}
