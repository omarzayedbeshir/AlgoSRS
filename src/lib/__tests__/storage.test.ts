import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAll,
  save,
  remove,
  markSynced,
  clearAll,
  getReviewSessionState,
  saveReviewSessionState,
} from '../../storage';
import type { LeetCodeEntry, Rating } from '../../types';

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

describe('storage', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('getAll returns empty array initially', async () => {
    expect(await getAll()).toEqual([]);
  });

  it('save adds a new entry', async () => {
    await save(make());
    const entries = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe('https://leetcode.com/problems/two-sum');
  });

  it('save updates existing entry by url', async () => {
    await save(make({ title: 'Old' }));
    await save(make({ title: 'New' }));
    const entries = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('New');
  });

  it('save preserves other entries when updating', async () => {
    await save(make({ id: '1', url: 'https://leetcode.com/problems/a' }));
    await save(make({ id: '2', url: 'https://leetcode.com/problems/b' }));
    await save(make({ id: '1', url: 'https://leetcode.com/problems/a', title: 'Updated' }));
    const entries = await getAll();
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.id === '2')).toBeDefined();
  });

  it('remove deletes entry by id', async () => {
    await save(make({ id: '1', url: 'https://leetcode.com/problems/a' }));
    await save(make({ id: '2', url: 'https://leetcode.com/problems/b' }));
    await remove('1');
    const entries = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('2');
  });

  it('remove is a no-op for non-existent id', async () => {
    await save(make({ id: '1' }));
    await remove('nonexistent');
    expect(await getAll()).toHaveLength(1);
  });

  it('markSynced sets syncStatus and lastSyncedAt on matching entries', async () => {
    await save(make({ id: '1', url: 'https://leetcode.com/problems/a' }));
    await save(make({ id: '2', url: 'https://leetcode.com/problems/b' }));
    await markSynced(['1']);
    const entries = await getAll();
    expect(entries.find((e) => e.id === '1')?.syncStatus).toBe('synced');
    expect(entries.find((e) => e.id === '1')?.lastSyncedAt).toBeDefined();
    expect(entries.find((e) => e.id === '2')?.syncStatus).toBeUndefined();
  });

  it('clearAll removes all entries', async () => {
    await save(make({ id: '1' }));
    await save(make({ id: '2' }));
    await clearAll();
    expect(await getAll()).toEqual([]);
  });

  it('saveReviewSessionState stores and getReviewSessionState returns it', async () => {
    const state = {
      ids: ['1', '2'],
      index: 1,
      results: [{ title: 'Two Sum', rating: 3 as Rating, scheduledDays: 4 }],
      skipped: 0,
      finished: false,
      startedAt: '2026-07-31T10:00:00.000Z',
    };
    await saveReviewSessionState(state);
    expect(await getReviewSessionState()).toEqual(state);
  });

  it('saveReviewSessionState(null) clears the stored session', async () => {
    await saveReviewSessionState({
      ids: ['1'],
      index: 0,
      results: [],
      skipped: 0,
      finished: false,
      startedAt: '2026-07-31T10:00:00.000Z',
    });
    await saveReviewSessionState(null);
    expect(await getReviewSessionState()).toBeNull();
  });

  it('getReviewSessionState returns null when nothing stored', async () => {
    expect(await getReviewSessionState()).toBeNull();
  });

  it('clearAll removes the stored session', async () => {
    await saveReviewSessionState({
      ids: ['1'],
      index: 0,
      results: [],
      skipped: 0,
      finished: false,
      startedAt: '2026-07-31T10:00:00.000Z',
    });
    await clearAll();
    expect(await getReviewSessionState()).toBeNull();
  });
});
