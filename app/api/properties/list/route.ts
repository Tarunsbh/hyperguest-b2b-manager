import { NextResponse } from 'next/server'
import { query } from '@/db/connection'

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
  const rows = await query<PropertyListRow>(
    `SELECT
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
  )
  return NextResponse.json({ success: true, data: rows })
}
