import type { LeetCodeEntry, Rating } from './types';

const ENTRIES_KEY = 'algosrs-entries';
const PENDING_DELETES_KEY = 'algosrs-pending-deletes';
const LAST_SYNC_KEY = 'algosrs-last-sync';
const DAILY_LIMIT_KEY = 'algosrs-daily-limit';
const DAILY_SPLIT_KEY = 'algosrs-daily-split';
const REVIEW_SESSION_KEY = 'algosrs-review-session';

const DEFAULT_DAILY_LIMIT = 5;

export interface DailySplit {
  date: string;
  limit: number;
  delayedIds: string[];
}

export interface ReviewResult {
  title: string;
  rating: Rating;
  scheduledDays: number;
}

export interface ReviewSessionState {
  ids: string[];
  index: number;
  results: ReviewResult[];
  skipped: number;
  finished: boolean;
  startedAt: string;
}

export async function getDailyLimit(): Promise<number> {
  const result = await chrome.storage.local.get<Record<string, number>>(DAILY_LIMIT_KEY);
  return result[DAILY_LIMIT_KEY] ?? DEFAULT_DAILY_LIMIT;
}

export async function setDailyLimit(limit: number): Promise<void> {
  await chrome.storage.local.set({ [DAILY_LIMIT_KEY]: limit });
}

export async function getDailySplit(): Promise<DailySplit | null> {
  const result = await chrome.storage.local.get<Record<string, DailySplit>>(DAILY_SPLIT_KEY);
  return result[DAILY_SPLIT_KEY] ?? null;
}

export async function setDailySplit(split: DailySplit): Promise<void> {
  await chrome.storage.local.set({ [DAILY_SPLIT_KEY]: split });
}

export async function getAll(): Promise<LeetCodeEntry[]> {
  const result = await chrome.storage.local.get<Record<string, LeetCodeEntry[]>>(ENTRIES_KEY);
  return result[ENTRIES_KEY] ?? [];
}

export async function getDirty(): Promise<LeetCodeEntry[]> {
  const entries = await getAll();
  return entries.filter((e) => e.needsSync || e.syncStatus === 'local');
}

export async function save(entry: LeetCodeEntry): Promise<void> {
  const entries = await getAll();
  const idx = entries.findIndex((e) => e.url === entry.url);
  if (idx >= 0) {
    entries[idx] = { ...entry, needsSync: true };
  } else {
    entries.push({ ...entry, needsSync: true });
  }
  await chrome.storage.local.set({ [ENTRIES_KEY]: entries });
}

export async function remove(id: string): Promise<void> {
  const entries = await getAll();
  const filtered = entries.filter((e) => e.id !== id);
  await chrome.storage.local.set({ [ENTRIES_KEY]: filtered });

  const pending = await getPendingDeletes();
  if (!pending.includes(id)) {
    pending.push(id);
    await chrome.storage.local.set({ [PENDING_DELETES_KEY]: pending });
  }
}

export async function getPendingDeletes(): Promise<string[]> {
  const result = await chrome.storage.local.get<Record<string, string[]>>(PENDING_DELETES_KEY);
  return result[PENDING_DELETES_KEY] ?? [];
}

export async function clearPendingDeletes(ids: string[]): Promise<void> {
  const pending = await getPendingDeletes();
  const remaining = pending.filter((id) => !ids.includes(id));
  await chrome.storage.local.set({ [PENDING_DELETES_KEY]: remaining });
}

export async function markSynced(ids: string[]): Promise<void> {
  const entries = await getAll();
  const now = new Date().toISOString();
  for (const entry of entries) {
    if (ids.includes(entry.id)) {
      entry.syncStatus = 'synced';
      entry.needsSync = false;
      entry.lastSyncedAt = now;
    }
  }
  await chrome.storage.local.set({ [ENTRIES_KEY]: entries });
}

export async function getLastSyncAt(): Promise<string | null> {
  const result = await chrome.storage.local.get<Record<string, string>>(LAST_SYNC_KEY);
  return result[LAST_SYNC_KEY] ?? null;
}

export async function setLastSyncAt(ts: string): Promise<void> {
  await chrome.storage.local.set({ [LAST_SYNC_KEY]: ts });
}

export async function getReviewSessionState(): Promise<ReviewSessionState | null> {
  const result =
    await chrome.storage.local.get<Record<string, ReviewSessionState>>(REVIEW_SESSION_KEY);
  return result[REVIEW_SESSION_KEY] ?? null;
}

export async function saveReviewSessionState(state: ReviewSessionState | null): Promise<void> {
  if (state === null) {
    await chrome.storage.local.remove(REVIEW_SESSION_KEY);
  } else {
    await chrome.storage.local.set({ [REVIEW_SESSION_KEY]: state });
  }
}

const REVIEW_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isActiveReviewSession(s: ReviewSessionState | null): s is ReviewSessionState {
  if (!s || s.finished) return false;
  if (!Array.isArray(s.ids) || s.ids.length === 0) return false;
  if (typeof s.index !== 'number' || s.index < 0) return false;
  if (Date.now() - new Date(s.startedAt).getTime() >= REVIEW_SESSION_MAX_AGE_MS) return false;
  return true;
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.remove([
    ENTRIES_KEY,
    PENDING_DELETES_KEY,
    LAST_SYNC_KEY,
    DAILY_SPLIT_KEY,
    REVIEW_SESSION_KEY,
  ]);
}
