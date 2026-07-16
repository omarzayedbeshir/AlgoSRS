import { getAll, save as localSave, markSynced } from '../storage';
import { api } from './api-client';
import type { LeetCodeEntry } from '../types';
import { getAuthState } from './supabase';

let _syncing = false;

export async function syncAll(): Promise<void> {
  const localEntries = await getAll();

  const response = await api.sync(localEntries, []);
  const remoteEntries: LeetCodeEntry[] = response.entries;

  const merged = new Map<string, LeetCodeEntry>();
  for (const e of localEntries) merged.set(e.url, e);
  for (const e of remoteEntries) {
    const existing = merged.get(e.url);
    if (!existing || new Date(e.updated_at || e.date) > new Date(existing.date)) {
      merged.set(e.url, { ...e, syncStatus: 'synced', lastSyncedAt: new Date().toISOString() });
    }
  }

  for (const entry of merged.values()) {
    await localSave(entry);
  }
  await markSynced([...merged.values()].map(e => e.id));
}

export async function autoSync(): Promise<void> {
  if (_syncing) { console.log('[sync] already syncing, skip'); return; }
  const state = await getAuthState();
  if (!state.isAuthenticated) { console.log('[sync] not authenticated, skip'); return; }

  _syncing = true;
  console.log('[sync] starting sync...');
  try {
    await syncAll();
    console.log('[sync] sync complete');
  } catch (err) {
    console.error('[sync] sync failed:', err);
  } finally {
    _syncing = false;
  }
}
