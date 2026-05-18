// ============================================================
// HyperGuest B2B Channel Manager - Properties React Query Hooks
// ============================================================

import { useQuery } from '@tanstack/react-query';
import type { PropertyDetail, PropertyListItem, Facility } from '../types';

// -------------------- QUERY KEYS --------------------

export const PROPERTY_KEYS = {
  all: ['properties'] as const,
  detail: (id: number) => ['properties', 'detail', id] as const,
  facilities: ['facilities'] as const,
} as const;

// -------------------- FETCH HELPERS --------------------

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ''}`);
  }
  return response.json() as Promise<T>;
}

// ── Envelope unwrapper ─────────────────────────────────────────────────────
// All our Next.js API routes return { success, data, ... }.
// These helpers unwrap the envelope so callers get the payload directly.

async function fetchList<T>(url: string): Promise<T[]> {
  const envelope = await fetchJson<{ success?: boolean; data?: T[] } | T[]>(url);
  if (Array.isArray(envelope)) return envelope;
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    const d = (envelope as { data?: T[] }).data;
    return Array.isArray(d) ? d : [];
  }
  return [];
}

async function fetchOne<T>(url: string): Promise<T> {
  const envelope = await fetchJson<{ success?: boolean; data?: T } | T>(url);
  if (envelope && typeof envelope === 'object' && 'data' in envelope && 'success' in envelope) {
    return (envelope as { data: T }).data;
  }
  return envelope as T;
}

// -------------------- HOOKS --------------------

/**
 * Fetch the full property list from our Next.js proxy route.
 * Stale time: 5 minutes — property list changes infrequently.
 */
export function usePropertyList() {
  return useQuery<PropertyListItem[], Error>({
    queryKey: PROPERTY_KEYS.all,
    queryFn: () => fetchList<PropertyListItem>('/api/properties'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch full static details for a single property.
 * Only runs when a valid id (> 0) is provided.
 * Stale time: 10 minutes — static property data is slow-moving.
 */
export function usePropertyDetail(id: number) {
  return useQuery<PropertyDetail, Error>({
    queryKey: PROPERTY_KEYS.detail(id),
    queryFn: () => fetchOne<PropertyDetail>(`/api/properties/${id}`),
    enabled: !!id && id > 0 && !isNaN(id),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch the global facilities / amenities catalogue.
 * Stale time: 60 minutes — facilities rarely change.
 */
export function useFacilities() {
  return useQuery<Facility[], Error>({
    queryKey: PROPERTY_KEYS.facilities,
    queryFn: () => fetchList<Facility>('/api/facilities'),
    staleTime: 60 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
    retry: 2,
  });
}
