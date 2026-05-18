// ============================================================
// HyperGuest B2B Channel Manager - Utility Functions
// ============================================================

import { format, parseISO, differenceInDays } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';

// -------------------- CLASSNAME MERGE --------------------

/**
 * Combines clsx + tailwind-merge so conflicting Tailwind classes are resolved
 * correctly (e.g. `cn('p-4', 'p-6')` → `'p-6'`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// -------------------- CURRENCY --------------------

/**
 * Format a numeric amount as a localised currency string.
 * Falls back to `${currency} ${amount}` if the locale API is unavailable.
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

// -------------------- DATE / TIME --------------------

/**
 * Format an ISO date string using date-fns.
 * @param dateStr  ISO 8601 string or any string parseISO can handle.
 * @param fmt      date-fns format token; defaults to 'dd/MM/yyyy'.
 */
export function formatDate(dateStr: string, fmt = 'dd/MM/yyyy'): string {
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

/**
 * Format an ISO date-time string with both date and time components.
 */
export function formatDateTime(dateStr: string): string {
  return formatDate(dateStr, 'dd/MM/yyyy HH:mm');
}

/**
 * Calculate the number of nights between two ISO date strings (checkIn → checkOut).
 * Returns 0 if the dates are equal or checkOut is before checkIn.
 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  try {
    const diff = differenceInDays(parseISO(checkOut), parseISO(checkIn));
    return Math.max(0, diff);
  } catch {
    return 0;
  }
}

// -------------------- STATUS --------------------

type StatusColorMap = Record<string, string>;

const STATUS_COLORS: StatusColorMap = {
  // Generic positive
  active: 'text-green-600',
  enabled: 'text-green-600',
  committed: 'text-green-600',
  success: 'text-green-600',
  confirmed: 'text-green-600',
  processed: 'text-green-600',

  // Generic negative
  inactive: 'text-red-600',
  disabled: 'text-red-600',
  failed: 'text-red-600',
  cancelled: 'text-red-600',
  canceled: 'text-red-600',
  error: 'text-red-600',
  unsubscribed: 'text-red-600',

  // Intermediate
  pending: 'text-yellow-600',
  processing: 'text-yellow-600',
  unprocessed: 'text-yellow-600',
  paused: 'text-yellow-600',

  // Informational
  test: 'text-blue-600',
  draft: 'text-gray-500',
};

/**
 * Return a Tailwind text-color class for a given status string.
 * Status comparison is case-insensitive. Defaults to 'text-gray-500'.
 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? 'text-gray-500';
}

/**
 * Return a shadcn/ui Badge variant for a given status string.
 */
export function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const key = status.toLowerCase();

  if (
    ['active', 'enabled', 'committed', 'success', 'confirmed', 'processed'].includes(key)
  ) {
    return 'default';
  }

  if (['inactive', 'disabled', 'failed', 'cancelled', 'canceled', 'error', 'unsubscribed'].includes(key)) {
    return 'destructive';
  }

  if (['pending', 'processing', 'unprocessed', 'paused'].includes(key)) {
    return 'secondary';
  }

  return 'outline';
}

// -------------------- STRING --------------------

/**
 * Truncate a string to maxLen characters, appending '…' when truncated.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

/**
 * Build a URL query string from a params object, skipping null/undefined values.
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

// -------------------- TOKEN / ID GENERATORS --------------------

/**
 * Generate a unique echo token for OTA booking requests.
 * Format: uppercase hex, 16 characters.
 */
export function generateEchoToken(): string {
  const arr = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    // Node.js fallback (server-side rendering)
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// -------------------- XML --------------------

/**
 * Parse a SOAP/XML string into a nested plain object.
 * Uses the browser's DOMParser when available; falls back to a lightweight
 * regex-based extractor in Node.js (server-side) environments.
 *
 * NOTE: This is a best-effort parser for simple OTA response envelopes.
 * For production-grade XML processing use a dedicated library (e.g. fast-xml-parser).
 */
export function parseXmlResponse(xmlString: string): Record<string, unknown> {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    return domNodeToObject(doc.documentElement);
  }

  // Minimal server-side fallback: extract text content of known tags
  return extractTagsFromXml(xmlString);
}

function domNodeToObject(node: Element): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Attributes
  for (const attr of Array.from(node.attributes)) {
    result[`@${attr.name}`] = attr.value;
  }

  // Children
  for (const child of Array.from(node.children)) {
    const childObj = domNodeToObject(child);
    const existing = result[child.localName];
    if (existing === undefined) {
      result[child.localName] = child.children.length === 0 ? child.textContent ?? '' : childObj;
    } else {
      // Multiple elements with the same tag → collect into array
      result[child.localName] = Array.isArray(existing)
        ? [...existing, child.children.length === 0 ? child.textContent ?? '' : childObj]
        : [existing, child.children.length === 0 ? child.textContent ?? '' : childObj];
    }
  }

  // If no children/attributes, return text content
  if (node.children.length === 0 && node.attributes.length === 0) {
    return { '#text': node.textContent ?? '' };
  }

  return result;
}

function extractTagsFromXml(xml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const tagPattern = /<(\w[\w:.-]*)[^>]*>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(xml)) !== null) {
    const [, tag, content] = match;
    const trimmed = content.trim();
    // Recurse if inner content also contains tags
    if (/<\w/.test(trimmed)) {
      result[tag] = extractTagsFromXml(trimmed);
    } else {
      result[tag] = trimmed;
    }
  }

  return result;
}

// -------------------- EXCEL / CSV EXPORT --------------------

/**
 * Trigger a browser download of an Excel (.xlsx) file built from an array of objects.
 * Each object becomes a row; keys become column headers.
 */
export function downloadExcel(data: unknown[], filename: string): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, safeName);
}

/**
 * Trigger a browser download of a CSV file built from an array of objects.
 */
export function downloadCSV(data: unknown[], filename: string): void {
  if (data.length === 0) return;

  const rows = data as Record<string, unknown>[];
  const headers = Object.keys(rows[0]);

  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const cell = row[h];
          const str = cell === null || cell === undefined ? '' : String(cell);
          // Escape cells that contain commas, quotes, or newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
