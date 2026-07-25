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
  getDirty: vi.fn<() => Promise<LeetCodeEntry[]>>(),
  save: vi.fn<(entry: LeetCodeEntry) => Promise<void>>(),
  markSynced: vi.fn<(ids: string[]) => Promise<void>>(),
  getPendingDeletes: vi.fn<() => Promise<string[]>>(),
  clearPendingDeletes: vi.fn<(ids: string[]) => Promise<void>>(),
  getLastSyncAt: vi.fn<() => Promise<string | null>>(),
  setLastSyncAt: vi.fn<(ts: string) => Promise<void>>(),
}));

const mockApi = vi.hoisted(() => ({
  sync: vi.fn<
    (entries: LeetCodeEntry[], deletedIds: string[], lastSyncAt?: string | null) => Promise<{ entries: LeetCodeEntry[] }>
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
    mockStorage.getLastSyncAt.mockResolvedValue(null);
    mockStorage.getPendingDeletes.mockResolvedValue([]);
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

      expect(mockApi.sync).toHaveBeenCalledWith(local, [], null);
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

    it('sends pending deletes to server and clears them', async () => {
      const local: LeetCodeEntry[] = [];
      const pendingDeletes = ['del-1', 'del-2'];

      mockStorage.getAll.mockResolvedValue(local);
      mockStorage.getPendingDeletes.mockResolvedValue(pendingDeletes);
      mockApi.sync.mockResolvedValue({ entries: [] });

      await syncAll();

      expect(mockApi.sync).toHaveBeenCalledWith(local, pendingDeletes, null);
      expect(mockStorage.clearPendingDeletes).toHaveBeenCalledWith(pendingDeletes);
    });

    it('skips sync when nothing has changed', async () => {
      mockStorage.getAll.mockResolvedValue([]);

      await syncAll();

      expect(mockApi.sync).not.toHaveBeenCalled();
    });

    it('uses dirty entries when lastSyncAt is set (delta sync)', async () => {
      const dirty = [make({ id: '1', needsSync: true })];
      const remote: LeetCodeEntry[] = [];

      mockStorage.getLastSyncAt.mockResolvedValue('2026-07-20T00:00:00.000Z');
      mockStorage.getDirty.mockResolvedValue(dirty);
      mockStorage.getPendingDeletes.mockResolvedValue([]);
      mockApi.sync.mockResolvedValue({ entries: remote });

      await syncAll();

      expect(mockApi.sync).toHaveBeenCalledWith(dirty, [], '2026-07-20T00:00:00.000Z');
    });
  });

  describe('autoSync', () => {
    it('skips sync when not authenticated', async () => {
      mockAuth.getAuthState.mockResolvedValue({ isAuthenticated: false });

      await autoSync();

      expect(mockApi.sync).not.toHaveBeenCalled();
    });

    it('runs sync when authenticated and has entries', async () => {
      mockAuth.getAuthState.mockResolvedValue({ isAuthenticated: true });
      mockStorage.getAll.mockResolvedValue([make()]);
      mockApi.sync.mockResolvedValue({ entries: [] });

      await autoSync();

      expect(mockApi.sync).toHaveBeenCalled();
    });

    it('handles sync error gracefully', async () => {
      mockAuth.getAuthState.mockResolvedValue({ isAuthenticated: true });
      mockStorage.getAll.mockResolvedValue([make()]);
      mockApi.sync.mockRejectedValue(new Error('network error'));

      await expect(autoSync()).resolves.not.toThrow();
    });
  });
});
