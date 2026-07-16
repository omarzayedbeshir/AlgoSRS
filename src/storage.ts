import type { LeetCodeEntry } from './types';

const ENTRIES_KEY = 'lc-fsrs-entries';

export async function getAll(): Promise<LeetCodeEntry[]> {
  const result = await chrome.storage.local.get(ENTRIES_KEY);
  return result[ENTRIES_KEY] || [];
}

export async function save(entry: LeetCodeEntry): Promise<void> {
  const entries = await getAll();
  const idx = entries.findIndex(e => e.url === entry.url);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  await chrome.storage.local.set({ [ENTRIES_KEY]: entries });
}

export async function remove(id: string): Promise<void> {
  const entries = await getAll();
  const filtered = entries.filter(e => e.id !== id);
  await chrome.storage.local.set({ [ENTRIES_KEY]: filtered });
}

export async function markSynced(ids: string[]): Promise<void> {
  const entries = await getAll();
  const now = new Date().toISOString();
  for (const entry of entries) {
    if (ids.includes(entry.id)) {
      entry.syncStatus = 'synced';
      entry.lastSyncedAt = now;
    }
  }
  await chrome.storage.local.set({ [ENTRIES_KEY]: entries });
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.remove(ENTRIES_KEY);
}

export async function markAllPending(): Promise<void> {
  const entries = await getAll();
  for (const entry of entries) {
    if (entry.syncStatus === 'synced') {
      entry.syncStatus = 'pending';
    }
  }
  await chrome.storage.local.set({ [ENTRIES_KEY]: entries });
}
