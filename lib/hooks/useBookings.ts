// ============================================================
// HyperGuest B2B Channel Manager - Bookings React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  StoredBooking,
  BookingPushRequest,
  BookingPushResponse,
  FilterState,
} from '../types';

// -------------------- QUERY KEYS --------------------

export const BOOKING_KEYS = {
  all: ['bookings'] as const,
  filtered: (filters?: FilterState, page?: number, pageSize?: number) =>
    ['bookings', 'filtered', filters, page, pageSize] as const,
  stats: ['bookings', 'stats'] as const,
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
  // Unwrap {success, data} envelope
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    if (!json.success && json.error) throw new Error(json.error);
    return json.data as T;
  }
  return json as T;
}

function buildFilterQueryString(filters?: FilterState, page = 1, pageSize = 25): string {
  const params: Record<string, string> = {
    page: String(page),
    pageSize: String(pageSize),
  };
  if (filters?.search) params.search = filters.search;
  if (filters?.status) params.status = filters.status;
  if (filters?.countryCode) params.countryCode = filters.countryCode;
  if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters?.dateTo) params.dateTo = filters.dateTo;
  return `?${new URLSearchParams(params).toString()}`;
}

export interface BookingStats {
  total: number;
  successful: number;
  failed: number;
  today: number;
  successRate: number;
  totalAmount: number;
  currency: string;
}

export interface BookingsPage {
  items: StoredBooking[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// -------------------- QUERY HOOKS --------------------

/**
 * Fetch paginated bookings from local DB with optional filters.
 * The API returns { items, total, page, pageSize, totalPages }.
 */
export function useBookings(filters?: FilterState, page = 1, pageSize = 25) {
  const qs = buildFilterQueryString(filters, page, pageSize);

  return useQuery<BookingsPage, Error>({
    queryKey: BOOKING_KEYS.filtered(filters, page, pageSize),
    queryFn: () => fetchJson<BookingsPage>(`/api/bookings${qs}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch booking statistics (count, success rate, amounts).
 */
export function useBookingStats() {
  return useQuery<BookingStats, Error>({
    queryKey: BOOKING_KEYS.stats,
    queryFn: () => fetchJson<BookingStats>('/api/bookings/stats'),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// -------------------- MUTATION HOOKS --------------------

/**
 * Push a new booking to HyperGuest via our proxy route.
 * Invalidates the bookings list and stats on settlement.
 */
export function usePushBooking() {
  const queryClient = useQueryClient();

  return useMutation<BookingPushResponse, Error, BookingPushRequest>({
    mutationFn: (payload) =>
      fetchJson<BookingPushResponse>('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.stats });
    },
  });
}
