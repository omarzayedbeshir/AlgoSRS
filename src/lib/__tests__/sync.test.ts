import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncAll, autoSync } from '../sync';
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

const mockStorage = vi.hoisted(() => ({
  getAll: vi.fn<() => Promise<LeetCodeEntry[]>>(),
  save: vi.fn<(entry: LeetCodeEntry) => Promise<void>>(),
  markSynced: vi.fn<(ids: string[]) => Promise<void>>(),
}));

const mockApi = vi.hoisted(() => ({
  sync: vi.fn<
    (entries: LeetCodeEntry[], deletedIds: string[]) => Promise<{ entries: LeetCodeEntry[] }>
  >(),
}));

const mockAuth = vi.hoisted(() => ({
  getAuthState: vi.fn<() => Promise<{ isAuthenticated: boolean }>>(),
}));

vi.mock('../../storage', () => mockStorage);
vi.mock('../api-client', () => ({ api: mockApi }));
vi.mock('../supabase', () => ({ getAuthState: mockAuth.getAuthState }));

describe('sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncAll', () => {
    it('sends local entries and merges remote entries', async () => {
      const local = [make({ id: '1', updatedAt: '2026-07-19T00:00:00.000Z' })];
      const remote = [
        make({ id: '1', updatedAt: '2026-07-20T00:00:00.000Z', title: 'Remote Updated' }),
      ];

      mockStorage.getAll.mockResolvedValue(local);
      mockApi.sync.mockResolvedValue({ entries: remote });

      await syncAll();

      expect(mockApi.sync).toHaveBeenCalledWith(local, []);
      expect(mockStorage.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Remote Updated', syncStatus: 'synced' }),
      );
      expect(mockStorage.markSynced).toHaveBeenCalled();
    });

    it('local entry wins when more recent', async () => {
      const local = [make({ id: '1', updatedAt: '2026-07-20T00:00:00.000Z' })];
      const remote = [make({ id: '1', updatedAt: '2026-07-19T00:00:00.000Z', title: 'Older' })];

      mockStorage.getAll.mockResolvedValue(local);
      mockApi.sync.mockResolvedValue({ entries: remote });

      await syncAll();

      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Two Sum' }));
    });

    it('remote entry wins when more recent', async () => {
      const local = [make({ id: '1', updatedAt: '2026-07-19T00:00:00.000Z' })];
      const remote = [make({ id: '1', updatedAt: '2026-07-20T00:00:00.000Z', title: 'Newer' })];

      mockStorage.getAll.mockResolvedValue(local);
      mockApi.sync.mockResolvedValue({ entries: remote });

      await syncAll();

      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Newer' }));
    });

    it('prefers local FSRS state over remote when remote has none', async () => {
      const local = [
        make({
          id: '1',
          updatedAt: '2026-07-19T00:00:00.000Z',
          fsrsState: 2,
          stability: 5.0,
          reps: 3,
        }),
      ];
      const remote = [
        make({
          id: '1',
          updatedAt: '2026-07-20T00:00:00.000Z',
          title: 'Older',
          fsrsState: 0,
          stability: 0,
          reps: 0,
        }),
      ];

      mockStorage.getAll.mockResolvedValue(local);
      mockApi.sync.mockResolvedValue({ entries: remote });

      await syncAll();

      expect(mockStorage.save).toHaveBeenCalledWith(
        expect.objectContaining({ fsrsState: 2, stability: 5.0 }),
      );
    });

    it('performs FSRS repair on entries missing FSRS state but having rating', async () => {
      const local = [
        make({
          id: '1',
          rating: 3,
          fsrsState: 0,
          stability: 0,
        }),
      ];
      const remote: LeetCodeEntry[] = [];

      mockStorage.getAll.mockResolvedValue(local);
      mockApi.sync.mockResolvedValue({ entries: remote });

      await syncAll();

      const saveCalls = mockStorage.save.mock.calls;
      const repairCall = saveCalls.find((args: LeetCodeEntry[]) => args[0].id === '1')?.[0];
      expect(repairCall).toBeDefined();
      expect(repairCall!.fsrsState).toBeGreaterThan(0);
      expect(repairCall!.stability).toBeGreaterThan(0);
    });
  });

  describe('autoSync', () => {
    it('skips sync when not authenticated', async () => {
      mockAuth.getAuthState.mockResolvedValue({ isAuthenticated: false });

      await autoSync();

      expect(mockApi.sync).not.toHaveBeenCalled();
    });

    it('runs sync when authenticated', async () => {
      mockAuth.getAuthState.mockResolvedValue({ isAuthenticated: true });
      mockStorage.getAll.mockResolvedValue([]);
      mockApi.sync.mockResolvedValue({ entries: [] });

      await autoSync();

      expect(mockApi.sync).toHaveBeenCalled();
    });

    it('handles sync error gracefully', async () => {
      mockAuth.getAuthState.mockResolvedValue({ isAuthenticated: true });
      mockApi.sync.mockRejectedValue(new Error('network error'));

      await expect(autoSync()).resolves.not.toThrow();
    });
  });
});
