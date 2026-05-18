// ============================================================
// HyperGuest B2B Channel Manager - Search React Query Hooks
// ============================================================

import { useQuery } from '@tanstack/react-query';
import type { SearchParams, SearchResult, CalendarParams, CalendarDay } from '../types';

// -------------------- QUERY KEYS --------------------

export const SEARCH_KEYS = {
  search: (params: SearchParams | null) => ['search', params] as const,
  calendar: (params: CalendarParams | null) => ['calendar', params] as const,
} as const;

// -------------------- FETCH HELPERS --------------------

/** Fetch JSON and automatically unwrap our {success, data} API envelope. */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ''}`);
  }
  const json = await response.json();
  // Unwrap {success, data} envelope returned by all our Next.js API routes
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    if (!json.success && json.error) throw new Error(json.error);
    return json.data as T;
  }
  return json as T;
}

function buildSearchQueryString(params: SearchParams): string {
  const qs = new URLSearchParams({
    checkIn: params.checkIn,
    nights: String(params.nights),
    guests: String(params.guests),
    hotelIds: String(params.hotelIds),
    customerNationality: params.customerNationality,
  });
  return qs.toString();
}

// -------------------- HOOKS --------------------

/**
 * Search for room availability.
 * Query is disabled when params is null — callers pass null to suspend the query.
 */
export function useSearch(params: SearchParams | null) {
  return useQuery<SearchResult, Error>({
    queryKey: SEARCH_KEYS.search(params),
    queryFn: async () => {
      if (!params) throw new Error('Search params are required');
      const qs = buildSearchQueryString(params);
      return fetchJson<SearchResult>(`/api/search?${qs}`);
    },
    enabled: params !== null,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Fetch ARI calendar data for a specific room & rate plan.
 * Query is disabled when params is null.
 */
export function useCalendar(params: CalendarParams | null) {
  return useQuery<CalendarDay[], Error>({
    queryKey: SEARCH_KEYS.calendar(params),
    queryFn: async () => {
      if (!params) throw new Error('Calendar params are required');
      return fetchJson<CalendarDay[]>('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    },
    enabled: params !== null,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}
