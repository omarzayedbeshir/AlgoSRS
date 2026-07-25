import { describe, it, expect, vi, afterEach } from 'vitest';
import { getReviewDates, computeStreak } from '../streak';
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

describe('getReviewDates', () => {
  it('returns empty array for no entries', () => {
    expect(getReviewDates([])).toEqual([]);
  });

  it('extracts date from lastReviewAt when present', () => {
    const e = make({ lastReviewAt: '2026-07-25T12:00:00.000Z' });
    expect(getReviewDates([e])).toEqual(['2026-07-25']);
  });

  it('falls back to date when lastReviewAt is undefined', () => {
    const e = make({ date: '2026-07-20T10:00:00.000Z', lastReviewAt: undefined });
    expect(getReviewDates([e])).toEqual(['2026-07-20']);
  });

  it('ignores updatedAt even when present', () => {
    const e = make({
      date: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-25T12:00:00.000Z',
      lastReviewAt: undefined,
    });
    expect(getReviewDates([e])).toEqual(['2026-07-20']);
  });

  it('returns unique sorted dates', () => {
    const entries = [
      make({ id: '1', lastReviewAt: '2026-07-25T00:00:00.000Z' }),
      make({ id: '2', lastReviewAt: '2026-07-24T00:00:00.000Z' }),
      make({ id: '3', lastReviewAt: '2026-07-25T12:00:00.000Z' }),
    ];
    expect(getReviewDates(entries)).toEqual(['2026-07-24', '2026-07-25']);
  });
});

describe('computeStreak', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for empty dates', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'));
    const dates = ['2026-07-25', '2026-07-24', '2026-07-23'];
    expect(computeStreak(dates)).toBe(3);
  });

  it('stops at gap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'));
    const dates = ['2026-07-25', '2026-07-24', '2026-07-22'];
    expect(computeStreak(dates)).toBe(2);
  });

  it('returns 0 if no activity today and no consecutive tail', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'));
    const dates = ['2026-07-24', '2026-07-23'];
    expect(computeStreak(dates)).toBe(0);
  });

  it('handles single day streak', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'));
    expect(computeStreak(['2026-07-25'])).toBe(1);
  });

  it('uses UTC for day boundary (late local evening is next UTC day)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T23:30:00.000-04:00'));
    const dates = ['2026-07-26', '2026-07-25'];
    expect(computeStreak(dates)).toBe(2);
  });

  it('uses UTC for day boundary (early local morning is still prior UTC day)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T01:00:00.000+05:00'));
    const dates = ['2026-07-25', '2026-07-24'];
    expect(computeStreak(dates)).toBe(2);
  });
});
