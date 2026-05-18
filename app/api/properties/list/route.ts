import { NextResponse } from 'next/server'
import axios from 'axios'
import { execute } from '@/db/connection'
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

export async function GET() {
  // Always fetch live from HyperGuest API
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

  const hotels: PropertyListRow[] = raw.map((h) => ({
    id:            (h.hotel_id ?? h.id)                       as number,
    name:          (h.name as string)                         ?? '',
    city:          (h.city as string)                         ?? null,
    countryCode:   ((h.country ?? h.countryCode) as string)   ?? null,
    address:       (h.address as string)                      ?? null,
    postcode:      (h.postcode as string)                     ?? null,
    region:        (h.region as string)                       ?? null,
    phone:         (h.phone as string)                        ?? null,
    email:         (h.email as string)                        ?? null,
    website:       (h.website as string)                      ?? null,
    latitude:      (h.latitude as number)                     ?? null,
    longitude:     (h.longitude as number)                    ?? null,
    timezone:      (h.timezone as string)                     ?? null,
    rating:        (h.rating as number)                       ?? null,
    status:        (h.status as string)                       ?? null,
    currency:      (h.currency as string)                     ?? null,
    checkIn:       ((h.checkIn ?? h.check_in) as string)      ?? null,
    checkOut:      ((h.checkOut ?? h.check_out) as string)    ?? null,
    numberOfRooms: (h.numberOfRooms as number)                ?? null,
    hotelType:     (h.hotelType as string)                    ?? null,
    commission:    (h.commission as number)                   ?? null,
    commissionType:(h.commissionType as string)               ?? null,
    isTest:        (h.isTest as number)                       ?? 0,
    detailSyncedAt: null,
  }))

  // Persist to DB as a side-effect (non-blocking, best-effort)
  void (async () => {
    for (const h of hotels) {
      try {
        await execute(
          `INSERT INTO hg_properties
             (id, name, rating, status, countryCode, city, currency, checkIn, checkOut, basicSyncedAt, syncedAt)
           VALUES
             (:id, :name, :rating, :status, :countryCode, :city, :currency, :checkIn, :checkOut, UTC_TIMESTAMP(), UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE
             name          = VALUES(name),
             rating        = VALUES(rating),
             status        = VALUES(status),
             countryCode   = VALUES(countryCode),
             city          = VALUES(city),
             currency      = VALUES(currency),
             checkIn       = VALUES(checkIn),
             checkOut      = VALUES(checkOut),
             basicSyncedAt = UTC_TIMESTAMP(),
             syncedAt      = UTC_TIMESTAMP()`,
          {
            id:          h.id,
            name:        h.name,
            rating:      h.rating ?? 0,
            status:      h.status ?? '',
            countryCode: h.countryCode ?? '',
            city:        h.city ?? '',
            currency:    h.currency ?? '',
            checkIn:     h.checkIn ?? '',
            checkOut:    h.checkOut ?? '',
          }
        )
      } catch { /* non-fatal */ }
    }
  })()

  return NextResponse.json({ success: true, data: hotels })
}
