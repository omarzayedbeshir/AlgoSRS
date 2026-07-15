import { getAll, save as localSave, remove as localRemove, markSynced, markAllPending } from '../storage';
import { api } from './api-client';
import type { LeetCodeEntry } from '../types';

export async function syncAll(): Promise<void> {
  const localEntries = await getAll();

  if (localEntries.length === 0) {
    return;
  }

  const response = await api.sync(localEntries, []);
  const remoteEntries: LeetCodeEntry[] = response.entries;

  const merged = new Map<string, LeetCodeEntry>();
  for (const e of localEntries) {
    merged.set(e.url, e);
  }
  for (const e of remoteEntries) {
    const existing = merged.get(e.url);
    if (!existing || new Date(e.updated_at || e.date) > new Date(existing.date)) {
      merged.set(e.url, { ...e, syncStatus: 'synced', lastSyncedAt: new Date().toISOString() });
    }
  }

  for (const entry of merged.values()) {
    await localSave(entry);
  }

  const syncedIds = [...merged.values()].map(e => e.id);
  await markSynced(syncedIds);
}

export async function syncAfterSave(entry: LeetCodeEntry): Promise<void> {
  try {
    const localEntries = await getAll();
    const response = await api.sync(localEntries, []);
    const remoteEntries: LeetCodeEntry[] = response.entries;

    const merged = new Map<string, LeetCodeEntry>();
    for (const e of localEntries) {
      merged.set(e.url, e);
    }
    for (const e of remoteEntries) {
      merged.set(e.url, { ...e, syncStatus: 'synced', lastSyncedAt: new Date().toISOString() });
    }

    const syncedIds: string[] = [];
    for (const entry of merged.values()) {
      await localSave(entry);
      syncedIds.push(entry.id);
    }
    await markSynced(syncedIds);
  } catch {
    await markAllPending();
    throw new Error('sync failed');
  }
}

export async function syncAfterDelete(id: string): Promise<void> {
  try {
    await api.deleteEntry(id);
  } catch {
    throw new Error('sync delete failed');
  }
}
