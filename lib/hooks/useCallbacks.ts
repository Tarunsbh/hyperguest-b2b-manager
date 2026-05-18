// ============================================================
// HyperGuest B2B Channel Manager - Callbacks React Query Hooks
// ============================================================

import { useQuery } from '@tanstack/react-query';
import type { StoredCallback } from '../types';

// -------------------- QUERY KEYS --------------------

export const CALLBACK_KEYS = {
  all: ['callbacks'] as const,
  paginated: (page: number, pageSize: number) =>
    ['callbacks', 'paginated', page, pageSize] as const,
  stats: ['callbacks', 'stats'] as const,
} as const;

// -------------------- FETCH HELPER --------------------

/** Fetch JSON and automatically unwrap our {success, data} API envelope. */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin' });
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

// -------------------- RESPONSE TYPES --------------------

export interface CallbacksPage {
  items: StoredCallback[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CallbackStats {
  total: number;
  unprocessed: number;
  processedToday: number;
  receivedToday: number;
  byDate: Array<{ callbackDate: string; count: number }>;
}

// -------------------- QUERY HOOKS --------------------

/**
 * Fetch a paginated page of ARI callback records.
 * Refetches every 30 seconds to surface new callbacks in near-real-time.
 */
export function useCallbacks(page = 1, pageSize = 25) {
  return useQuery<CallbacksPage, Error>({
    queryKey: CALLBACK_KEYS.paginated(page, pageSize),
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      }).toString();
      return fetchJson<CallbacksPage>(`/api/callbacks?${qs}`);
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
    retry: 2,
  });
}

/**
 * Fetch aggregate statistics about received callbacks.
 * Refetches every minute.
 */
export function useCallbackStats() {
  return useQuery<CallbackStats, Error>({
    queryKey: CALLBACK_KEYS.stats,
    queryFn: () => fetchJson<CallbackStats>('/api/callbacks/stats'),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
  });
}
