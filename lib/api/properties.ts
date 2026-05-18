// ============================================================
// HyperGuest B2B - Properties API Service
// ============================================================

import { staticClient, operationsClient, withRetry } from './client';
import type { PropertyDetail, PropertyListItem } from '../types';

/**
 * GET https://hg-static.hyperguest.com/hotels.json
 * Returns the list of all available properties.
 * Uses STATIC_TOKEN.
 */
export async function fetchPropertyList(): Promise<PropertyListItem[]> {
  const response = await withRetry(() => staticClient.get<PropertyListItem[]>('/hotels.json'));
  return response.data;
}

/**
 * GET https://hg-static.hyperguest.com/{hotelId}/property-static.json
 * Returns full static details for a single property.
 * Uses OPERATIONS_TOKEN (fc35030b...)
 */
export async function fetchPropertyDetail(hotelId: number | string): Promise<PropertyDetail> {
  const response = await withRetry(() =>
    operationsClient.get<PropertyDetail>(`/${hotelId}/property-static.json`)
  );
  return response.data;
}

/**
 * GET https://hg-static.hyperguest.com/facilities.json
 * Returns the global facilities/amenities catalogue.
 * Uses OPERATIONS_TOKEN
 */
export async function fetchFacilities(): Promise<unknown[]> {
  const response = await withRetry(() => operationsClient.get<unknown[]>('/facilities.json'));
  return response.data;
}
