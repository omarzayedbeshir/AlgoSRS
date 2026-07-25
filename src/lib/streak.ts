import type { LeetCodeEntry } from '../types';

export function getReviewDates(entries: LeetCodeEntry[]): string[] {
  const dates = new Set<string>();
  for (const e of entries) {
    const d = e.lastReviewAt || e.date;
    if (d) dates.add(d.slice(0, 10));
  }
  return [...dates].sort();
}

export function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const dateSet = new Set(dates);
  const today = new Date().toISOString().slice(0, 10);
  const [y, m, d] = today.split('-').map(Number);
  const current = new Date(Date.UTC(y, m - 1, d));
  let count = 0;
  for (let i = 0; ; i++) {
    const key = current.toISOString().slice(0, 10);
    if (dateSet.has(key)) count++;
    else break;
    current.setUTCDate(current.getUTCDate() - 1);
  }
  return count;
}
