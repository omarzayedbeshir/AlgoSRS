import { vi } from 'vitest';

const store: Record<string, any> = {};

const mockChromeStorage = {
  get: vi.fn(async (keys?: any) => {
    if (keys === null || keys === undefined) return { ...store };
    if (typeof keys === 'string') {
      const val = store[keys];
      return val !== undefined ? { [keys]: val } : {};
    }
    if (Array.isArray(keys)) {
      const result: Record<string, any> = {};
      for (const k of keys) {
        if (k in store) result[k] = store[k];
      }
      return result;
    }
    if (typeof keys === 'object') {
      const result = { ...keys };
      for (const k of Object.keys(keys)) {
        if (k in store) result[k] = store[k];
      }
      return result;
    }
    return {};
  }),
  set: vi.fn(async (items: Record<string, any>) => {
    Object.assign(store, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    for (const k of ks) delete store[k];
  }),
  clear: vi.fn(async () => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
  getBytesInUse: vi.fn(async () => 0),
  QUOTA_BYTES: 10485760,
};

vi.stubGlobal('chrome', {
  storage: {
    local: mockChromeStorage,
  },
  runtime: {
    id: 'test-extension-id',
  },
  action: {},
});
