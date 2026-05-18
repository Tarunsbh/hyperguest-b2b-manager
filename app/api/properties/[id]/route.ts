// ============================================================
// GET /api/properties/[id]
// Fetches full property detail from HyperGuest Static API,
// caches raw JSON in MSSQL `hg_properties`.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { execute } from '@/db/connection';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';
import type { PropertyDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { success: false, data: null, error: 'Property ID is required' },
      { status: 400 }
    );
  }

  try {
    // ---- Fetch from HyperGuest Static API ----
    const response = await axios.get<PropertyDetail>(
      `${BASE_URLS.STATIC}/${id}/property-static.json`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    const raw = response.data as unknown as Record<string, unknown>

    // ── Normalise rooms: pmsCode → code ────────────────────────────────────
    const rooms = (Array.isArray(raw.rooms) ? raw.rooms : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((room: any) => ({
        ...room,
        code: room.pmsCode ?? room.code ?? undefined,
      }))

    // ── Normalise ratePlans: filter nulls, pmsCode → code ──────────────────
    const ratePlans = (Array.isArray(raw.ratePlans) ? raw.ratePlans : [])
      .filter(Boolean)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((rp: any) => ({
        ...rp,
        code: rp.pmsCode ?? rp.code ?? undefined,
      }))

    // ── Normalise settings.chain: object → string name ────────────────────
    const settings = raw.settings
      ? {
          ...(raw.settings as Record<string, unknown>),
          chain:
            typeof (raw.settings as Record<string, unknown>).chain === 'object' &&
            (raw.settings as Record<string, unknown>).chain !== null
              ? ((raw.settings as Record<string, unknown>).chain as { name: string }).name
              : (raw.settings as Record<string, unknown>).chain,
        }
      : raw.settings

    const property = { ...raw, rooms, ratePlans, settings } as PropertyDetail

    // ---- Persist full detail to MySQL (best-effort) ----
    try {
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
          id:             property.id,
          name:           property.name ?? '',
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
      )
    } catch {
      // DB write failure is non-fatal
    }

    return NextResponse.json({
      success: true,
      data: property,
    });
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `External API error: ${err.response?.status} ${err.message}`
      : err instanceof Error
      ? err.message
      : 'Unknown error';

    console.error(`[GET /api/properties/${id}]`, message);

    const status = axios.isAxiosError(err) && err.response?.status === 404 ? 404 : 502;

    return NextResponse.json(
      { success: false, data: null, error: message },
      { status }
    );
  }
}
