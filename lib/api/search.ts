// ============================================================
// HyperGuest B2B - Search API Service
// ============================================================

import { searchClient, withRetry } from './client';
import type { SearchParams, SearchResult, CalendarParams, CalendarDay } from '../types';

/**
 * GET https://search-api.hyperguest.io/2.0
 * Search for available rooms across one or more properties.
 * Uses OPERATIONS_TOKEN
 */
export async function searchAvailability(params: SearchParams): Promise<SearchResult> {
  const response = await withRetry(() =>
    searchClient.get<SearchResult>('/2.0', {
      params: {
        checkIn: params.checkIn,
        nights: params.nights,
        guests: params.guests,
        hotelIds: params.hotelIds,
        customerNationality: params.customerNationality,
      },
    })
  );
  return response.data;
}

/**
 * POST https://search-api.hyperguest.io/calendar
 * Returns ARI (Availability, Rates, Inventory) per day for a specific room & rate plan.
 * Uses OPERATIONS_TOKEN
 */
export async function fetchCalendar(params: CalendarParams): Promise<CalendarDay[]> {
  const response = await withRetry(() =>
    searchClient.post<CalendarDay[]>('/calendar', {
      propertyId: params.propertyId,
      roomCode: params.roomCode,
      rateplanCode: params.rateplanCode,
      startDate: params.startDate,
      endDate: params.endDate,
    })
  );
  return response.data;
}
