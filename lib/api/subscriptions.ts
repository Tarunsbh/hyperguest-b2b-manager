// ============================================================
// HyperGuest B2B - Subscriptions API Service
// ============================================================

import { pdmClient, withRetry } from './client';
import type { SubscribeRequest, SubscribeResponse, SubscriptionDetail } from '../types';
import { API_TOKENS, BASE_URLS } from './client';

/**
 * POST https://pdm.hyperguest.io/api/pdm/subscriptions/subscribe
 * Subscribe to ARI updates for one or more properties.
 */
export async function subscribe(payload: SubscribeRequest): Promise<SubscribeResponse> {
  const response = await withRetry(() =>
    pdmClient.post<SubscribeResponse>('/api/pdm/subscriptions/subscribe', payload)
  );
  return response.data;
}

/**
 * GET https://pdm.hyperguest.io/api/pdm/subscriptions/{subscriptionId}/getSubscriptionDetails
 * Retrieve details of a specific subscription.
 */
export async function getSubscriptionDetails(subscriptionId: string): Promise<SubscriptionDetail> {
  const response = await withRetry(() =>
    pdmClient.get<SubscriptionDetail>(
      `/api/pdm/subscriptions/${subscriptionId}/getSubscriptionDetails`
    )
  );
  return response.data;
}

/**
 * GET https://pdm.hyperguest.io/api/pdm/subscriptions/{subscriptionId}/unsubscribe
 * Unsubscribe (disable) an existing subscription.
 */
export async function unsubscribe(subscriptionId: string): Promise<unknown> {
  const response = await withRetry(() =>
    pdmClient.get(`/api/pdm/subscriptions/${subscriptionId}/unsubscribe`)
  );
  return response.data;
}

/**
 * GET https://pdm.hyperguest.io/api/pdm/subscriptions/{subscriptionId}/enableSubscription
 * Re-enable a disabled subscription. Uses STATIC_TOKEN (9d49c17f...)
 */
export async function enableSubscription(subscriptionId: string): Promise<unknown> {
  const { default: axios } = await import('axios');
  const response = await withRetry(() =>
    axios.get(
      `${BASE_URLS.PDM}/api/pdm/subscriptions/${subscriptionId}/enableSubscription`,
      { headers: { Authorization: `Bearer ${API_TOKENS.STATIC_TOKEN}` } }
    )
  );
  return response.data;
}

/**
 * Build a default subscribe payload from property details
 */
export function buildSubscribePayload(
  propertyId: number,
  ratePlanCodes: string[],
  userId = 'pradeep_s',
  callbackUrl = BASE_URLS.EGLOBE_CALLBACK
): SubscribeRequest {
  return {
    method: 'ARI',
    propertyIds: [propertyId],
    ratePlans: [{ propertyId, ratePlanCodes }],
    userId,
    envelope: 'Hyperguest',
    authentication: { bearer: API_TOKENS.CALLBACK_TOKEN },
    envelopeSubUrls: { Callback: callbackUrl },
    email: process.env.NEXT_PUBLIC_SUBSCRIPTION_EMAIL || 'it@eglobe-solutions.com',
    parameters: {},
    version: 1,
  };
}
