import { supabase } from './supabase';

const BACKEND_URL = import.meta.env.WXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
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
}

export const api = {
  listEntries: () => request('/api/entries'),

  upsertEntry: (entry: {
    id: string;
    title: string;
    url: string;
    difficulty: string;
    rating: number;
    date: string;
  }) =>
    request('/api/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  deleteEntry: (id: string) =>
    request(`/api/entries?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  sync: (entries: any[], deletedIds: string[]) =>
    request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ entries, deleted_ids: deletedIds }),
    }),
};
