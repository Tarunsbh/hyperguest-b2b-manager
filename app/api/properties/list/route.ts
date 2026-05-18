import { NextResponse } from 'next/server'
import axios from 'axios'
import { query, execute } from '@/db/connection'
import { API_TOKENS, BASE_URLS } from '@/lib/api/client'

export const dynamic = 'force-dynamic'

export interface PropertyListRow {
  id: number
  name: string
  city: string | null
  countryCode: string | null
  address: string | null
  postcode: string | null
  region: string | null
  phone: string | null
  email: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  rating: number | null
  status: string | null
  currency: string | null
  checkIn: string | null
  checkOut: string | null
  numberOfRooms: number | null
  hotelType: string | null
  commission: number | null
  commissionType: string | null
  isTest: number
  detailSyncedAt: string | null
}

const SELECT_ALL = `
  SELECT
    id, name, city, countryCode,
    address, postcode, region,
    phone, email, website,
    latitude, longitude, timezone,
    rating, status, currency, checkIn, checkOut,
    numberOfRooms, hotelType,
    commission, commissionType,
    isTest, detailSyncedAt
  FROM hg_properties
  ORDER BY name ASC`

export async function GET() {
  // 1. Try DB first (fast path)
  const dbRows = await query<PropertyListRow>(SELECT_ALL)
  if (dbRows.length > 0) {
    return NextResponse.json({ success: true, data: dbRows, source: 'db' })
  }

  // 2. DB is empty — fetch live from HyperGuest and populate DB
  try {
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

    // Save to DB so subsequent calls are fast
    for (const h of raw) {
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
            id:          (h.hotel_id ?? h.id) as number,
            name:        (h.name as string) ?? '',
            rating:      (h.rating as number) ?? 0,
            status:      (h.status as string) ?? '',
            countryCode: ((h.country ?? h.countryCode) as string) ?? '',
            city:        (h.city as string) ?? '',
            currency:    (h.currency as string) ?? '',
            checkIn:     ((h.checkIn ?? h.check_in) as string) ?? '',
            checkOut:    ((h.checkOut ?? h.check_out) as string) ?? '',
          }
        )
      } catch { /* individual failure is non-fatal */ }
    }

    // Return freshly saved rows from DB (now has data)
    const freshRows = await query<PropertyListRow>(SELECT_ALL)
    return NextResponse.json({ success: true, data: freshRows, source: 'api' })
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `HyperGuest API error: ${err.response?.status} ${err.message}`
      : err instanceof Error ? err.message : 'Unknown error'

    console.error('[GET /api/properties/list]', message)
    return NextResponse.json({ success: false, data: [], error: message }, { status: 502 })
  }
}
