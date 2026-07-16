import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthState } from '../types';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = import.meta.env.WXT_PUBLIC_SUPABASE_URL;
  const key = import.meta.env.WXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const chromeStorageAdapter = {
    getItem: async (k: string) => {
      const r = await chrome.storage.local.get(k);
      return r[k] ?? null;
    },
    setItem: async (k: string, v: string) => {
      await chrome.storage.local.set({ [k]: v });
    },
    removeItem: async (k: string) => {
      await chrome.storage.local.remove(k);
    },
  };

  _supabase = createClient(url, key, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  return _supabase;
}

export { getSupabase };

export async function getAuthState(): Promise<AuthState> {
  const sb = getSupabase();
  if (!sb) return { isAuthenticated: false };

  const { data } = await sb.auth.getSession();
  if (!data.session) {
    return { isAuthenticated: false };
  }
  return {
    isAuthenticated: true,
    userId: data.session.user.id,
    email: data.session.user.email ?? undefined,
  };
}
