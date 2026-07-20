import { describe, it, expect } from 'vitest';
import { reviewEntry } from '../fsrs';
import type { LeetCodeEntry } from '../../types';

function make(overrides: Partial<LeetCodeEntry> = {}): LeetCodeEntry {
  return {
    id: 'test-id',
    title: 'Two Sum',
    url: 'https://leetcode.com/problems/two-sum',
    difficulty: 'easy',
    rating: 3,
    date: new Date(Date.now() - 86400000).toISOString(),
    ...overrides,
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

describe('fsrs', () => {
  describe('reviewEntry', () => {
    it('returns updated entry with FSRS fields', async () => {
      const entry = make({ rating: 3 });
      const { updatedEntry, scheduledDays } = reviewEntry(entry, 3);
      expect(updatedEntry.stability).toBeGreaterThan(0);
      expect(updatedEntry.difficultyFsrs).toBeGreaterThan(0);
      expect(updatedEntry.reps).toBe(1);
      expect(updatedEntry.lapses).toBe(0);
      expect(updatedEntry.fsrsState).toBeGreaterThan(0);
      expect(updatedEntry.dueDate).toBeDefined();
      expect(updatedEntry.lastReviewAt).toBeDefined();
      expect(updatedEntry.updatedAt).toBeDefined();
      expect(scheduledDays).toBeGreaterThanOrEqual(0);
    });

    it('increments reps on subsequent reviews', () => {
      const { updatedEntry: first } = reviewEntry(make({ rating: 3 }), 3);
      const { updatedEntry: second } = reviewEntry(
        make({
          rating: 3,
          reps: first.reps,
          fsrsState: first.fsrsState,
          stability: first.stability,
          difficultyFsrs: first.difficultyFsrs,
          dueDate: first.dueDate,
          lastReviewAt: first.lastReviewAt,
        }),
        3,
      );
      expect(second.reps).toBe(first.reps! + 1);
    });

    it('increments lapses on Again rating', () => {
      const { updatedEntry: first } = reviewEntry(make({ rating: 3 }), 3);
      const { updatedEntry: second } = reviewEntry(
        make({
          rating: 1,
          lapses: 1,
          reps: first.reps,
          fsrsState: first.fsrsState,
          stability: first.stability,
          difficultyFsrs: first.difficultyFsrs,
          dueDate: first.dueDate,
          lastReviewAt: first.lastReviewAt,
        }),
        1,
      );
      expect(second.lapses).toBeGreaterThan(0);
    });

    it('handles fresh entry without FSRS state', () => {
      const entry = make({ rating: 3 });
      const { updatedEntry } = reviewEntry(entry, 3);
      expect(updatedEntry.stability).toBeGreaterThan(0);
      expect(updatedEntry.reps).toBe(1);
    });

    it('restores card state from existing entry', () => {
      const { updatedEntry: first } = reviewEntry(make({ rating: 3 }), 3);
      const { updatedEntry: second } = reviewEntry(
        make({
          rating: 3,
          reps: first.reps,
          fsrsState: first.fsrsState,
          stability: first.stability,
          difficultyFsrs: first.difficultyFsrs,
          dueDate: first.dueDate,
          lastReviewAt: first.lastReviewAt,
        }),
        3,
      );
      expect(second.fsrsState).toBeGreaterThan(0);
      expect(second.reps).toBe(first.reps! + 1);
    });
  });

  describe('rating effects on stability', () => {
    const base = make({ date: daysAgo(1) });

    it('Again rating produces lowest stability', () => {
      const r1 = reviewEntry(base, 1);
      const r4 = reviewEntry(base, 4);
      expect(r1.updatedEntry.stability!).toBeLessThan(r4.updatedEntry.stability!);
    });

    it('Hard and Good produce intermediate stability', () => {
      const r2 = reviewEntry(base, 2);
      const r3 = reviewEntry(base, 3);
      expect(r2.updatedEntry.stability!).toBeLessThan(r3.updatedEntry.stability!);
    });
  });
});
