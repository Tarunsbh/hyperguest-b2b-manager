// ============================================================
// HyperGuest B2B - Booking Push API Service (OTA/SOAP)
// ============================================================

import { bookClient, withRetry } from './client';
import type { BookingPushRequest, BookingPushResponse, BookingRoom, BookingGuest } from '../types';

// -------------------- XML BUILDER --------------------

/**
 * Build OTA_HotelResNotifRQ SOAP envelope.
 * Handles 1–N rooms, mixed adult/child/infant guest counts.
 */
export function buildOtaXml(req: BookingPushRequest): string {
  const ts = req.timestamp || new Date().toISOString();

  // Build room stays XML
  const roomStays = req.rooms
    .map((room) => {
      const guestCounts: string[] = [];
      if (room.adults > 0) guestCounts.push(`<GuestCount AgeQualifyingCode="10" Count="${room.adults}"/>`);
      if (room.children > 0) guestCounts.push(`<GuestCount AgeQualifyingCode="8" Count="${room.children}"/>`);
      if (room.infants > 0) guestCounts.push(`<GuestCount AgeQualifyingCode="7" Count="${room.infants}"/>`);

      return `
        <RoomStay>
          <RatePlans>
            <RatePlan RatePlanCode="${room.ratePlanCode}"/>
          </RatePlans>
          <RoomRates>
            <RoomRate RoomTypeCode="${room.roomTypeCode}" RatePlanCode="${room.ratePlanCode}" NumberOfUnits="${room.numberOfUnits}">
              <Rates>
                <Rate>
                  <Base AmountBeforeTax="${room.amountBeforeTax.toFixed(2)}" AmountAfterTax="${room.amountAfterTax.toFixed(2)}" CurrencyCode="${room.currency}">
                    <Taxes><Tax Amount="0.0" CurrencyCode="${room.currency}" Type="exclusive"/></Taxes>
                  </Base>
                  <Total AmountBeforeTax="${room.amountBeforeTax.toFixed(2)}" AmountAfterTax="${room.amountAfterTax.toFixed(2)}" CurrencyCode="${room.currency}">
                    <Taxes><Tax Amount="0.0" CurrencyCode="${room.currency}" Type="exclusive"/></Taxes>
                  </Total>
                </Rate>
              </Rates>
            </RoomRate>
          </RoomRates>
          <ResGuestRPHs><ResGuestRPH RPH="1"/></ResGuestRPHs>
          <GuestCounts IsPerRoom="1">
            ${guestCounts.join('\n            ')}
          </GuestCounts>
          <TimeSpan Start="${room.checkIn}" End="${room.checkOut}"/>
          <Total AmountBeforeTax="${room.amountBeforeTax.toFixed(2)}" AmountAfterTax="${room.amountAfterTax.toFixed(2)}" CurrencyCode="${room.currency}">
            <Taxes><Tax Amount="0.0" CurrencyCode="${room.currency}" Type="exclusive"/></Taxes>
          </Total>
          <BasicPropertyInfo HotelCode="${req.hotelCode}"/>
        </RoomStay>`;
    })
    .join('');

  const g = req.guest;
  const guestXml = `
        <ResGuest ResGuestRPH="1" PrimaryIndicator="1">
          <Profiles>
            <ProfileInfo>
              <Profile ProfileType="1">
                <Customer>
                  <PersonName>
                    <GivenName>${escapeXml(g.firstName)}</GivenName>
                    <Surname>${escapeXml(g.lastName)}</Surname>
                  </PersonName>
                  <Telephone PhoneNumber="${escapeXml(g.phone)}"/>
                  <Email>${escapeXml(g.email)}</Email>
                  <Address>
                    <PostalCode>${escapeXml(g.postalCode || '')}</PostalCode>
                    <AddressLine>${escapeXml(g.addressLine || '')}</AddressLine>
                    <CountryName Code="${escapeXml(g.countryCode || 'IN')}"/>
                    <StateProv>${escapeXml(g.state || '')}</StateProv>
                    <City>${escapeXml(g.city || '')}</City>
                  </Address>
                </Customer>
              </Profile>
            </ProfileInfo>
          </Profiles>
        </ResGuest>`;

  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope/">
  <soap:Body>
    <OTA_HotelResNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05"
      Version="1.0"
      EchoToken="${req.echoToken || '123abc'}"
      ResStatus="${req.resStatus || 'Commit'}"
      TimeStamp="${ts}">
      <HotelReservations>
        <HotelReservation CreateDateTime="${ts}">
          <UniqueID Type="14" ID="${req.reservationId}"/>
          <RoomStays>
            ${roomStays}
          </RoomStays>
          <ResGuests>
            ${guestXml}
          </ResGuests>
          <ResGlobalInfo>
            <Total AmountBeforeTax="${req.totalAmountBeforeTax.toFixed(2)}" AmountAfterTax="${req.totalAmountAfterTax.toFixed(2)}" CurrencyCode="${req.currency}">
              <Taxes><Tax Amount="0.0" CurrencyCode="${req.currency}" Type="exclusive"/></Taxes>
            </Total>
            <Profiles>
              <ProfileInfo>
                <Profile>
                  <Customer>
                    <PersonName>
                      <GivenName>${escapeXml(g.firstName)}</GivenName>
                      <Surname>${escapeXml(g.lastName)}</Surname>
                    </PersonName>
                    <Telephone PhoneNumber="${escapeXml(g.phone)}"/>
                    <Email>${escapeXml(g.email)}</Email>
                  </Customer>
                </Profile>
              </ProfileInfo>
            </Profiles>
          </ResGlobalInfo>
        </HotelReservation>
      </HotelReservations>
    </OTA_HotelResNotifRQ>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// -------------------- API CALL --------------------

/**
 * POST https://book-api.hyperguest.com/envelope/booking/OTA/reservation
 * Push an OTA reservation to HyperGuest.
 */
export async function pushBooking(req: BookingPushRequest): Promise<BookingPushResponse> {
  const xml = buildOtaXml(req);

  try {
    const response = await withRetry(() =>
      bookClient.post<string>('/envelope/booking/OTA/reservation', xml, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'OTA_HotelResNotifRQ',
        },
      })
    );

    return {
      success: true,
      reservationId: req.reservationId,
      status: 'Committed',
      rawResponse: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      reservationId: req.reservationId,
      status: 'Failed',
      message: msg,
    };
  }
}

// -------------------- RESERVATION ID GENERATOR --------------------
export function generateReservationId(prefix = 'EGS'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

// -------------------- GUEST COUNT HELPERS --------------------
export function totalGuests(rooms: BookingRoom[]): { adults: number; children: number; infants: number } {
  return rooms.reduce(
    (acc, r) => ({
      adults: acc.adults + r.adults,
      children: acc.children + r.children,
      infants: acc.infants + r.infants,
    }),
    { adults: 0, children: 0, infants: 0 }
  );
}
