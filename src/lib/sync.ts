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
    let toSave = entry;
    if ((!entry.fsrsState || entry.fsrsState === 0) && entry.rating) {
      const { updatedEntry } = reviewEntry(entry, entry.rating as Rating);
      toSave = updatedEntry;
    }
    await localSave(toSave);
  }

  await markSynced([...merged.values()].map(e => e.id));
}

export async function autoSync(): Promise<void> {
  if (_syncing) return;
  const state = await getAuthState();
  if (!state.isAuthenticated) return;

  _syncing = true;
  try {
    await syncAll();
  } catch {
  } finally {
    _syncing = false;
  }
}
