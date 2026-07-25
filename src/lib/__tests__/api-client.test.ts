import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api-client';
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

vi.mock('../supabase', () => ({
  getSupabase: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: 'mock-token' } }, error: null }),
      ),
    },
  })),
}));

describe('api-client', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  function mockResponse(data: any, status = 200) {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  it('upsertEntry sends POST with entry JSON', async () => {
    mockResponse({ id: 'new-id' });
    const entry = make();
    const result = await api.upsertEntry(entry);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/entries');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toMatchObject({ id: 'test-id', title: 'Two Sum' });
    expect(result).toEqual({ id: 'new-id' });
  });

  it('sync sends POST with entries and deletedIds', async () => {
    mockResponse({ entries: [{ id: '1' }] });
    const entries = [make({ id: '1' })];
    const result = await api.sync(entries, ['deleted-1']);

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      entries: expect.arrayContaining([expect.objectContaining({ id: '1' })]),
      deleted_ids: ['deleted-1'],
      last_sync_at: null,
    });
    expect(result).toEqual({ entries: [{ id: '1' }] });
  });

  it('deleteEntry sends DELETE with id param', async () => {
    mockResponse({ status: 'deleted' });
    await api.deleteEntry('entry-1');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/entries?id=entry-1');
    expect(opts.method).toBe('DELETE');
  });

  it('deleteAllEntries sends DELETE to user entries', async () => {
    mockResponse({ status: 'deleted' });
    await api.deleteAllEntries();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/user/entries');
    expect(opts.method).toBe('DELETE');
  });

  it('deleteUser sends DELETE to user with confirm', async () => {
    mockResponse({ status: 'deleted' });
    await api.deleteUser(true);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/user?confirm=true');
    expect(opts.method).toBe('DELETE');
  });

  it('requestDeleteUser sends POST to delete-request', async () => {
    mockResponse({ status: 'confirmation_required' });
    await api.requestDeleteUser();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/user/delete-request');
    expect(opts.method).toBe('POST');
  });

  it('includes Authorization header when token exists', async () => {
    mockResponse({});
    await api.upsertEntry(make());

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers).toMatchObject({ Authorization: 'Bearer mock-token' });
  });

  it('throws ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(api.upsertEntry(make())).rejects.toThrow(/Not Found/);
  });

  it('uses timeout controller', async () => {
    let usedSignal: AbortSignal | undefined;
    mockFetch.mockImplementation((_url: string, opts: any) => {
      usedSignal = opts.signal;
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    await api.upsertEntry(make());
    expect(usedSignal).toBeDefined();
  });
});
