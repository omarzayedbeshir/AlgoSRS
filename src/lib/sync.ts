import { getAll, save as localSave, markSynced } from '../storage';
import { api } from './api-client';
import type { LeetCodeEntry, Rating } from '../types';
import { getAuthState } from './supabase';
import { reviewEntry } from './fsrs';

let _syncing = false;

export async function syncAll(): Promise<void> {
  const localEntries = await getAll();

  const response = await api.sync(localEntries, []);
  const remoteEntries: LeetCodeEntry[] = response.entries;

  const merged = new Map<string, LeetCodeEntry>();
  for (const e of localEntries) merged.set(e.url, e);
  for (const e of remoteEntries) {
    const existing = merged.get(e.url);
    const localTime = existing?.updatedAt || existing?.date;
    const remoteTime = e.updatedAt || e.date;
    if (!existing || (remoteTime && (!localTime || new Date(remoteTime) > new Date(localTime)))) {
      if (existing?.fsrsState && existing.fsrsState !== 0 && (!e.fsrsState || e.fsrsState === 0)) {
        continue;
      }
      merged.set(e.url, { ...e, syncStatus: 'synced', lastSyncedAt: new Date().toISOString() });
    }
  }

  for (const entry of merged.values()) {
    await localSave(entry);
  }

  for (const entry of merged.values()) {
    if ((!entry.fsrsState || entry.fsrsState === 0) && entry.rating) {
      const { updatedEntry } = reviewEntry(entry, entry.rating as Rating);
      await localSave(updatedEntry);
    }
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
