import { getSupabase } from './supabase';
import type { LeetCodeEntry } from '../types';

const BACKEND_URL = import.meta.env.WXT_PUBLIC_BACKEND_URL;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

async function request(path: string, options: RequestInit = {}, retries = 0): Promise<any> {
  const sb = getSupabase();
  const { data } = sb ? await sb.auth.getSession() : { data: null };
  const token = data?.session?.access_token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (res.status === 429 && retries < MAX_RETRIES) {
      const retryAfter = res.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * Math.pow(2, retries);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return request(path, options, retries + 1);
    }

    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
        const parsed = JSON.parse(body);
        body = parsed.error || body;
      } catch {
        /* empty */
      }
      throw new ApiError(body || res.statusText, res.status);
    }

    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  upsertEntry: (entry: LeetCodeEntry) =>
    request('/api/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  deleteEntry: (id: string) =>
    request(`/api/entries?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  deleteAllEntries: () => request('/api/user/entries', { method: 'DELETE' }),

  requestDeleteUser: () => request('/api/user/delete-request', { method: 'POST' }),

  deleteUser: (confirm: boolean) => request(`/api/user?confirm=${confirm}`, { method: 'DELETE' }),

  sync: (entries: LeetCodeEntry[], deletedIds: string[], lastSyncAt?: string | null) =>
    request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ entries, deleted_ids: deletedIds, last_sync_at: lastSyncAt ?? null }),
    }),
};

export { ApiError };
