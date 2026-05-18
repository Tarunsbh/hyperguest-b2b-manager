// ============================================================
// HyperGuest B2B Channel Manager - Axios API Client
// ============================================================

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// -------------------- TOKEN REGISTRY --------------------
// Set all NEXT_PUBLIC_HG_* variables in .env.local — no defaults are provided here.
const _apiToken =
  process.env.NEXT_PUBLIC_HG_API_TOKEN ||
  process.env.NEXT_PUBLIC_HG_STATIC_TOKEN ||
  '';

export const API_TOKENS = {
  STATIC_TOKEN: _apiToken,
  OPERATIONS_TOKEN: process.env.NEXT_PUBLIC_HG_OPERATIONS_TOKEN || _apiToken,
  CALLBACK_TOKEN: process.env.NEXT_PUBLIC_HG_CALLBACK_TOKEN || '',
} as const;

// -------------------- BASE URLS --------------------
export const BASE_URLS = {
  STATIC: process.env.NEXT_PUBLIC_HG_STATIC_URL || 'https://hg-static.hyperguest.com',
  SEARCH: process.env.NEXT_PUBLIC_HG_SEARCH_URL || 'https://search-api.hyperguest.io',
  PDM: process.env.NEXT_PUBLIC_HG_PDM_URL || 'https://pdm.hyperguest.io',
  BOOK: process.env.NEXT_PUBLIC_HG_BOOK_URL || 'https://book-api.hyperguest.com',
  EGLOBE_CALLBACK: process.env.NEXT_PUBLIC_EGLOBE_CALLBACK_URL ||
    'https://www.eglobe-solutions.com/webapichannelmanager/hyperguestb2bsubscription/callback/ariupdates',
} as const;

// -------------------- REQUEST / RESPONSE LOG --------------------
export interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  error?: string;
}

const requestLogs: RequestLog[] = [];
export const getRequestLogs = () => [...requestLogs];
export const clearRequestLogs = () => { requestLogs.length = 0; };

// -------------------- FACTORY --------------------
function createClient(baseURL: string, token: string, contentType = 'application/json'): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': contentType,
      'Authorization': `Bearer ${token}`,
    },
  });

  // Request interceptor – log & annotate
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    (config as AxiosRequestConfig & { metadata?: { startTime: number; requestId: string } }).metadata = {
      startTime: Date.now(),
      requestId: Math.random().toString(36).slice(2, 9),
    };
    return config;
  });

  // Response interceptor – log result
  instance.interceptors.response.use(
    (response) => {
      const cfg = response.config as AxiosRequestConfig & { metadata?: { startTime: number; requestId: string } };
      const duration = cfg.metadata ? Date.now() - cfg.metadata.startTime : 0;
      requestLogs.unshift({
        id: cfg.metadata?.requestId || '',
        timestamp: new Date().toISOString(),
        method: response.config.method?.toUpperCase() || 'GET',
        url: response.config.url || '',
        status: response.status,
        duration,
      });
      if (requestLogs.length > 100) requestLogs.pop();
      return response;
    },
    (error: AxiosError) => {
      const cfg = error.config as (AxiosRequestConfig & { metadata?: { startTime: number; requestId: string } }) | undefined;
      const duration = cfg?.metadata ? Date.now() - cfg.metadata.startTime : 0;
      requestLogs.unshift({
        id: cfg?.metadata?.requestId || '',
        timestamp: new Date().toISOString(),
        method: error.config?.method?.toUpperCase() || 'GET',
        url: error.config?.url || '',
        status: error.response?.status,
        duration,
        error: error.message,
      });
      if (requestLogs.length > 100) requestLogs.pop();
      return Promise.reject(error);
    }
  );

  return instance;
}

// -------------------- NAMED CLIENTS --------------------
export const staticClient = createClient(BASE_URLS.STATIC, API_TOKENS.STATIC_TOKEN);
export const operationsClient = createClient(BASE_URLS.STATIC, API_TOKENS.OPERATIONS_TOKEN);
export const searchClient = createClient(BASE_URLS.SEARCH, API_TOKENS.OPERATIONS_TOKEN);
export const pdmClient = createClient(BASE_URLS.PDM, API_TOKENS.OPERATIONS_TOKEN);
export const bookClient = createClient(BASE_URLS.BOOK, API_TOKENS.OPERATIONS_TOKEN, 'text/xml');
export const callbackClient = createClient(BASE_URLS.EGLOBE_CALLBACK, API_TOKENS.CALLBACK_TOKEN);

// -------------------- RETRY HELPER --------------------
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// -------------------- ERROR NORMALISER --------------------
export function normalizeApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'string') return data;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    return `HTTP ${error.response?.status}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
