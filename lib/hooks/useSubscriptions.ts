// ============================================================
// HyperGuest B2B Channel Manager - Subscriptions React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  StoredSubscription,
  SubscriptionDetail,
  SubscribeRequest,
  SubscribeResponse,
} from '../types';

// -------------------- QUERY KEYS --------------------

export const SUBSCRIPTION_KEYS = {
  all: ['subscriptions'] as const,
  list: ['subscriptions', 'list'] as const,
  detail: (id: string) => ['subscriptions', 'detail', id] as const,
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

// -------------------- QUERY HOOKS --------------------

/**
 * Fetch all subscriptions stored in our local DB.
 */
export function useSubscriptions() {
  return useQuery<StoredSubscription[], Error>({
    queryKey: SUBSCRIPTION_KEYS.all,
    queryFn: () => fetchJson<StoredSubscription[]>('/api/subscriptions'),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch the live subscription list from HyperGuest PDM
 * via GET /api/subscriptions/list (merges with local DB).
 */
export function useSubscriptionList(params?: { userId?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.userId) qs.set('userId', params.userId);
  if (params?.status)  qs.set('status',  params.status);
  const url = `/api/subscriptions/list${qs.toString() ? `?${qs}` : ''}`;

  // fetchJson unwraps the {success, data} envelope, so the resolved value is
  // the `data` array (SubscriptionDetail[]), not the outer envelope object.
  return useQuery<SubscriptionDetail[], Error>({
    queryKey: [...SUBSCRIPTION_KEYS.list, params],
    queryFn: () => fetchJson<SubscriptionDetail[]>(url),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch details for a single subscription by its ID.
 */
export function useSubscriptionDetail(id: string) {
  return useQuery<SubscriptionDetail, Error>({
    queryKey: SUBSCRIPTION_KEYS.detail(id),
    queryFn: () => fetchJson<SubscriptionDetail>(`/api/subscriptions/${id}`),
    enabled: !!id,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// -------------------- MUTATION HOOKS --------------------

/**
 * Subscribe to ARI updates for one or more properties.
 * Invalidates the subscriptions list on success.
 */
export function useSubscribe() {
  const queryClient = useQueryClient();

  return useMutation<SubscribeResponse, Error, SubscribeRequest>({
    mutationFn: (payload) =>
      fetchJson<SubscribeResponse>('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEYS.all });
    },
  });
}

/**
 * Disable (unsubscribe) a subscription — keeps local DB record with status=disabled.
 */
export function useUnsubscribe() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: (subscriptionId) =>
      fetchJson<unknown>(`/api/subscriptions/${subscriptionId}/unsubscribe`, {
        method: 'POST',
      }),
    onSuccess: (_data, subscriptionId) => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEYS.detail(subscriptionId) });
    },
  });
}

/**
 * Hard delete: unsubscribes from HyperGuest (best-effort) and removes from local DB.
 */
export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: (subscriptionId) =>
      fetchJson<unknown>(`/api/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEYS.all });
    },
  });
}

/**
 * Re-enable a disabled subscription by ID.
 */
export function useEnableSubscription() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: (subscriptionId) =>
      fetchJson<unknown>(`/api/subscriptions/${subscriptionId}/enable`, {
        method: 'POST',
      }),
    onSuccess: (_data, subscriptionId) => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEYS.detail(subscriptionId) });
    },
  });
}
