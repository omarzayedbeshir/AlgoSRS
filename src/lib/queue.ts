import type { LeetCodeEntry } from '../types';
import { getAll, getDailyLimit, getDailySplit, setDailySplit, type DailySplit } from '../storage';

export interface ReviewQueue {
  all: LeetCodeEntry[];
  dueNow: LeetCodeEntry[];
  delayed: LeetCodeEntry[];
  upcoming: LeetCodeEntry[];
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDue(entry: LeetCodeEntry, today: string): boolean {
  return !entry.dueDate || entry.dueDate.slice(0, 10) <= today;
}

export function sortByDue(entries: LeetCodeEntry[]): LeetCodeEntry[] {
  return [...entries].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    if (da !== db) return da - db;
    const sa = a.stability ?? 0;
    const sb = b.stability ?? 0;
    return sa - sb;
  });
}

export function computeDelayedIds(
  due: LeetCodeEntry[],
  dailyLimit: number,
  split: DailySplit | null,
  today: string,
): string[] {
  if (due.length === 0 || dailyLimit === 0) return [];
  if (split && split.date === today && split.limit === dailyLimit) {
    const dueIdSet = new Set(due.map((e) => e.id));
    return split.delayedIds.filter((id) => dueIdSet.has(id));
  }
  return due.slice(dailyLimit).map((e) => e.id);
}

export async function getReviewQueue(): Promise<ReviewQueue> {
  const [all, dailyLimit, split] = await Promise.all([getAll(), getDailyLimit(), getDailySplit()]);
  const today = todayKey();
  const due = sortByDue(all.filter((e) => isDue(e, today)));
  const upcoming = sortByDue(all.filter((e) => e.dueDate && e.dueDate.slice(0, 10) > today));

  let delayedIds: string[];
  if (due.length === 0 || dailyLimit === 0) {
    delayedIds = [];
    if (split) await setDailySplit({ date: today, limit: dailyLimit, delayedIds: [] });
  } else if (split && split.date === today && split.limit === dailyLimit) {
    delayedIds = computeDelayedIds(due, dailyLimit, split, today);
  } else {
    delayedIds = due.slice(dailyLimit).map((e) => e.id);
    await setDailySplit({ date: today, limit: dailyLimit, delayedIds });
  }

  const delayedSet = new Set(delayedIds);
  return {
    all,
    dueNow: due.filter((e) => !delayedSet.has(e.id)),
    delayed: due.filter((e) => delayedSet.has(e.id)),
    upcoming,
  };
}
