import { createClient } from '@supabase/supabase-js';
import type { AuthState } from '../types';

const SUPABASE_URL = import.meta.env.WXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.WXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Set WXT_PUBLIC_SUPABASE_URL and WXT_PUBLIC_SUPABASE_ANON_KEY in .env'
  );
}

const chromeStorageAdapter = {
  getItem: async (key: string) => {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },
  setItem: async (key: string, value: string) => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string) => {
    await chrome.storage.local.remove(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: false,
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
  },
});

export async function getAuthState(): Promise<AuthState> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return { isAuthenticated: false };
  }
  return {
    isAuthenticated: true,
    userId: data.session.user.id,
    email: data.session.user.email ?? undefined,
  };
}
