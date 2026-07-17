import { getSupabase } from './supabase';
import type { LeetCodeEntry } from '../types';

const BACKEND_URL = import.meta.env.WXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;

async function request(path: string, options: RequestInit = {}) {
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

    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(body || res.statusText, res.status);
    }

    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  listEntries: () => request('/api/entries'),

  upsertEntry: (entry: LeetCodeEntry) =>
    request('/api/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  deleteEntry: (id: string) =>
    request(`/api/entries?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  deleteAllEntries: () =>
    request('/api/user/entries', { method: 'DELETE' }),

  deleteUser: () =>
    request('/api/user', { method: 'DELETE' }),

  sync: (entries: any[], deletedIds: string[]) =>
    request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ entries, deleted_ids: deletedIds }),
    }),
};
