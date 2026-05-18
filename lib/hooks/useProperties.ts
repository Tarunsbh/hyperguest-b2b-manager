// ============================================================
// HyperGuest B2B Channel Manager — Properties React Query Hooks
//
// Optimizations:
//  - Server-side filtering + pagination (tiny responses)
//  - staleTime 24h — DB handles freshness, no unnecessary refetches
//  - keepPreviousData — instant page transitions (no loading flash)
//  - Unique query keys per filter combo — each combo is cached separately
// ============================================================

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { PropertyDetail, PropertyListItem, Facility } from '../types'

// ── Query key factory ─────────────────────────────────────────────────────────
export const PROPERTY_KEYS = {
  all:        ['properties'] as const,
  list:       (p: PropertyListParams) => ['properties', 'list', p] as const,
  detail:     (id: number)            => ['properties', 'detail', id] as const,
  facilities: ['facilities']          as const,
}

// ── Param types ───────────────────────────────────────────────────────────────
export interface PropertyListParams {
  page?:     number
  pageSize?: number
  search?:   string
  status?:   string
  country?:  string
  sort?:     string
  refresh?:  boolean
}

export interface PropertyListMeta {
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
  countries:  string[]
  fromCache:  boolean
  cachedAt:   string | null
}

export interface PropertyListResult {
  data: PropertyListItem[]
  meta: PropertyListMeta
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchList(params: PropertyListParams): Promise<PropertyListResult> {
  const qs = new URLSearchParams()
  if (params.page)                             qs.set('page',     String(params.page))
  if (params.pageSize)                         qs.set('pageSize', String(params.pageSize))
  if (params.search)                           qs.set('search',   params.search)
  if (params.status  && params.status  !== 'all') qs.set('status',  params.status)
  if (params.country && params.country !== 'all') qs.set('country', params.country)
  if (params.sort    && params.sort    !== 'name') qs.set('sort',    params.sort)
  if (params.refresh)                          qs.set('refresh',  '1')

  const url = `/api/properties${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`)
  }

  const json = await res.json() as {
    success: boolean
    data?: PropertyListItem[]
    meta?: PropertyListMeta
    error?: string
  }

  if (!json.success) throw new Error(json.error ?? 'Failed to load properties')

  return {
    data: Array.isArray(json.data) ? json.data : [],
    meta: json.meta ?? {
      total: 0, page: 1, pageSize: 25, totalPages: 1,
      countries: [], fromCache: false, cachedAt: null,
    },
  }
}

async function fetchOne<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`)
  }
  const envelope = await res.json() as { success?: boolean; data?: T } | T
  if (envelope && typeof envelope === 'object' && 'data' in envelope && 'success' in envelope) {
    return (envelope as { data: T }).data
  }
  return envelope as T
}

async function fetchFacilities<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const envelope = await res.json() as { success?: boolean; data?: T[] } | T[]
  if (Array.isArray(envelope)) return envelope
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    const d = (envelope as { data?: T[] }).data
    return Array.isArray(d) ? d : []
  }
  return []
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Server-filtered, paginated property list.
 * Returns 25 records per page (~5KB) instead of the full 4MB dataset.
 * Data served from DB cache — zero HyperGuest calls after first load.
 */
export function usePropertyList(params: PropertyListParams = {}) {
  const p: PropertyListParams = {
    page:     params.page     ?? 1,
    pageSize: params.pageSize ?? 25,
    search:   params.search   ?? '',
    status:   params.status   ?? 'all',
    country:  params.country  ?? 'all',
    sort:     params.sort     ?? 'name',
    refresh:  params.refresh  ?? false,
  }

  return useQuery<PropertyListResult, Error>({
    queryKey:        PROPERTY_KEYS.list(p),
    queryFn:         () => fetchList(p),
    staleTime:       24 * 60 * 60 * 1000,  // 24h — DB manages freshness
    gcTime:          24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,       // no loading flash on page change
    retry: 1,
  })
}

/**
 * Full property detail — cached 24h in DB.
 */
export function usePropertyDetail(id: number) {
  return useQuery<PropertyDetail, Error>({
    queryKey:  PROPERTY_KEYS.detail(id),
    queryFn:   () => fetchOne<PropertyDetail>(`/api/properties/${id}`),
    enabled:   !!id && id > 0 && !isNaN(id),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime:    24 * 60 * 60 * 1000,
    retry: 1,
  })
}

/**
 * Global facilities catalogue — rarely changes.
 */
export function useFacilities() {
  return useQuery<Facility[], Error>({
    queryKey:  PROPERTY_KEYS.facilities,
    queryFn:   () => fetchFacilities<Facility>('/api/facilities'),
    staleTime: 60 * 60 * 1000,
    gcTime:    120 * 60 * 1000,
    retry: 1,
  })
}
