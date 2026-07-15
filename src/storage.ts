import type { LeetCodeEntry } from './types';

const STORAGE_KEY = 'lc-fsrs-entries';

export async function getAll(): Promise<LeetCodeEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

export async function save(entry: LeetCodeEntry): Promise<void> {
  const entries = await getAll();
  const idx = entries.findIndex(e => e.url === entry.url);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}

export async function remove(id: string): Promise<void> {
  const entries = await getAll();
  const filtered = entries.filter(e => e.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}
