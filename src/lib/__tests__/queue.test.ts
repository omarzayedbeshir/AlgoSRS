import { describe, it, expect, beforeEach } from 'vitest';
import { getAll, save, clearAll, getDailySplit, setDailyLimit } from '../../storage';
import { getReviewQueue, computeDelayedIds, sortByDue, todayKey } from '../queue';
import type { LeetCodeEntry } from '../../types';

function make(overrides: Partial<LeetCodeEntry> = {}): LeetCodeEntry {
  return {
    id: 'test-id',
    title: 'Two Sum',
    url: 'https://leetcode.com/problems/two-sum',
    difficulty: 'easy',
    rating: 3,
    date: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

const today = todayKey();
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowKey = tomorrow.toISOString().slice(0, 10);
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayKey = yesterday.toISOString().slice(0, 10);

describe('queue', () => {
  beforeEach(async () => {
    await clearAll();
    await setDailyLimit(5);
  });

  it('returns empty queues with no entries', async () => {
    const q = await getReviewQueue();
    expect(q.all).toEqual([]);
    expect(q.dueNow).toEqual([]);
    expect(q.delayed).toEqual([]);
    expect(q.upcoming).toEqual([]);
  });

  it('splits due entries by daily limit', async () => {
    for (let i = 0; i < 7; i++) {
      await save(make({ id: `d${i}`, url: `https://leetcode.com/problems/p${i}` }));
    }
    const q = await getReviewQueue();
    expect(q.dueNow).toHaveLength(5);
    expect(q.delayed).toHaveLength(2);
    expect(q.upcoming).toHaveLength(0);
  });

  it('dueNow when limit is 0', async () => {
    await save(make({ id: 'd1', url: 'https://leetcode.com/problems/p1' }));
    await save(make({ id: 'd2', url: 'https://leetcode.com/problems/p2' }));
    await setDailyLimit(0);
    const q = await getReviewQueue();
    expect(q.dueNow).toHaveLength(2);
    expect(q.delayed).toHaveLength(0);
  });

  it('places future-dated entries in upcoming', async () => {
    await save(make({ id: 'd1', url: 'https://leetcode.com/problems/p1' }));
    await save(
      make({
        id: 'u1',
        url: 'https://leetcode.com/problems/u1',
        dueDate: `${tomorrowKey}T12:00:00.000Z`,
      }),
    );
    const q = await getReviewQueue();
    expect(q.dueNow.map((e) => e.id)).toEqual(['d1']);
    expect(q.upcoming.map((e) => e.id)).toEqual(['u1']);
  });

  it('reuses the daily split from the same day', async () => {
    for (let i = 0; i < 7; i++) {
      await save(make({ id: `d${i}`, url: `https://leetcode.com/problems/p${i}` }));
    }
    const first = await getReviewQueue();
    const second = await getReviewQueue();
    expect(second.delayed.map((e) => e.id)).toEqual(first.delayed.map((e) => e.id));
  });

  it('sorts due entries by dueDate then stability', async () => {
    const entries = [
      make({ id: 'a', stability: 10, dueDate: `${tomorrowKey}T00:00:00.000Z` }),
      make({ id: 'b', stability: 5, dueDate: `${today}T00:00:00.000Z` }),
      make({ id: 'c', stability: 1, dueDate: `${today}T00:00:00.000Z` }),
    ];
    const sorted = sortByDue(entries);
    expect(sorted.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('computeDelayedIds validates stored ids against current due set', async () => {
    const due = [
      make({ id: 'a', url: 'https://leetcode.com/problems/a' }),
      make({ id: 'b', url: 'https://leetcode.com/problems/b' }),
      make({ id: 'c', url: 'https://leetcode.com/problems/c' }),
    ];
    const split = { date: today, limit: 2, delayedIds: ['c', 'stale'] };
    expect(computeDelayedIds(due, 2, split, today)).toEqual(['c']);
  });

  it('computeDelayedIds recomputes when the split is stale', async () => {
    const due = [
      make({ id: 'a', url: 'https://leetcode.com/problems/a' }),
      make({ id: 'b', url: 'https://leetcode.com/problems/b' }),
      make({ id: 'c', url: 'https://leetcode.com/problems/c' }),
    ];
    const split = { date: yesterdayKey, limit: 2, delayedIds: ['c'] };
    expect(computeDelayedIds(due, 2, split, today)).toEqual(['c']);
    expect(await getDailySplit()).toBeNull();
  });

  it('getReviewQueue persists a fresh daily split', async () => {
    for (let i = 0; i < 7; i++) {
      await save(make({ id: `d${i}`, url: `https://leetcode.com/problems/p${i}` }));
    }
    await getReviewQueue();
    const split = await getDailySplit();
    expect(split).not.toBeNull();
    expect(split!.date).toBe(today);
    expect(split!.delayedIds).toHaveLength(2);
  });

  it('reviewing an entry clears it from the due queue', async () => {
    const entry = make({ id: 'd1', url: 'https://leetcode.com/problems/p1' });
    await save(entry);
    await getReviewQueue();
    const updated = { ...entry, dueDate: `${tomorrowKey}T12:00:00.000Z` };
    await save(updated);
    const q = await getReviewQueue();
    expect(q.dueNow).toHaveLength(0);
    expect(q.upcoming.map((e) => e.id)).toEqual(['d1']);
  });

  it('getAll still returns everything saved', async () => {
    await save(make({ id: 'd1', url: 'https://leetcode.com/problems/p1' }));
    expect(await getAll()).toHaveLength(1);
  });
});
