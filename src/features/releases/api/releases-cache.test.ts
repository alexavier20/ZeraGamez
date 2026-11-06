import { describe, expect, it, vi } from 'vitest';

import {
  createReleasesCache,
  RELEASES_CACHE_STORAGE_KEY,
  RELEASES_CACHE_TTL_MS,
} from './releases-cache';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

const response: ReleasesResponse = {
  data: [],
  meta: {
    from: '2026-11-05',
    to: '2027-02-03',
    count: 0,
    limit: 100,
    generatedAt: '2026-11-05T12:00:00.000Z',
    sourceTruncated: false,
  },
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('releases cache', () => {
  it('reuses responses in memory and restores them after a reload without extending their lifetime', async () => {
    let now = 1_000;
    const storage = memoryStorage();
    const options = { now: () => now, storage: () => storage };
    const cache = createReleasesCache(options);
    const request = vi.fn().mockResolvedValue(response);

    await expect(cache.load('releases', request)).resolves.toEqual(response);
    await expect(cache.load('releases', request)).resolves.toEqual(response);
    expect(request).toHaveBeenCalledTimes(1);

    now += RELEASES_CACHE_TTL_MS - 1;
    const restored = createReleasesCache(options);
    await expect(restored.load('releases', request)).resolves.toEqual(response);
    expect(request).toHaveBeenCalledTimes(1);

    now += 1;
    await restored.load('releases', request);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps dates, filters and pages isolated', async () => {
    const cache = createReleasesCache({ storage: () => null });
    const request = vi.fn().mockResolvedValue(response);
    const keys = ['today:all', 'tomorrow:all', 'today:pc', 'today:pc:offset100'];
    for (const key of keys) await cache.load(key, request);
    for (const key of keys) await cache.load(key, request);
    expect(request).toHaveBeenCalledTimes(keys.length);
  });

  it('shares an in-flight request while allowing one consumer to cancel independently', async () => {
    const cache = createReleasesCache({ storage: () => null });
    const result = deferred<ReleasesResponse>();
    const request = vi
      .fn<(signal: AbortSignal) => Promise<ReleasesResponse>>()
      .mockReturnValue(result.promise);
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = cache.load('same', request, firstController.signal);
    const second = cache.load('same', request, secondController.signal);
    const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();

    firstController.abort();
    await cancelled;
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0].aborted).toBe(false);

    result.resolve(response);
    await expect(second).resolves.toEqual(response);
    await cache.load('same', request);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('cancels the upstream request when all consumers leave and ignores its late result', async () => {
    const cache = createReleasesCache({ storage: () => null });
    const oldResult = deferred<ReleasesResponse>();
    const request = vi
      .fn<(signal: AbortSignal) => Promise<ReleasesResponse>>()
      .mockReturnValue(oldResult.promise);
    const controller = new AbortController();
    const pending = cache.load('same', request, controller.signal);
    const cancelled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await cancelled;
    expect(request.mock.calls[0]?.[0].aborted).toBe(true);

    const fresh = { ...response, meta: { ...response.meta, generatedAt: '2026-11-05T13:00:00Z' } };
    const freshRequest = vi.fn().mockResolvedValue(fresh);
    await expect(cache.load('same', freshRequest)).resolves.toEqual(fresh);
    oldResult.resolve(response);
    await Promise.resolve();
    await Promise.resolve();
    await expect(cache.load('same', freshRequest)).resolves.toEqual(fresh);
    expect(freshRequest).toHaveBeenCalledTimes(1);
  });

  it('does not start a request for an already cancelled consumer, even on a cache hit', async () => {
    const cache = createReleasesCache({ storage: () => null });
    const request = vi.fn().mockResolvedValue(response);
    const signal = AbortSignal.abort();
    await expect(cache.load('same', request, signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).not.toHaveBeenCalled();
    await cache.load('same', request);
    await expect(cache.load('same', request, signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not cache request failures, so a retry reaches the API', async () => {
    const storage = memoryStorage();
    const cache = createReleasesCache({ storage: () => storage });
    const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response);
    await expect(cache.load('same', request)).rejects.toThrow('offline');
    expect(storage.setItem).not.toHaveBeenCalled();
    await expect(cache.load('same', request)).resolves.toEqual(response);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each(['invalid json', '[{"key":"same","savedAt":1000,"response":{"data":"invalid"}}]'])(
    'ignores corrupted persistent data: %s',
    async (serialized) => {
      const storage = memoryStorage();
      storage.setItem(RELEASES_CACHE_STORAGE_KEY, serialized);
      const cache = createReleasesCache({ now: () => 1_000, storage: () => storage });
      const request = vi.fn().mockResolvedValue(response);
      await expect(cache.load('same', request)).resolves.toEqual(response);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects timestamps in the future after a clock change', async () => {
    const storage = memoryStorage();
    storage.setItem(
      RELEASES_CACHE_STORAGE_KEY,
      JSON.stringify([{ key: 'same', savedAt: 2_000, response }]),
    );
    const cache = createReleasesCache({ now: () => 1_000, storage: () => storage });
    const request = vi.fn().mockResolvedValue(response);
    await cache.load('same', request);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('continues in memory when browser storage is blocked or full', async () => {
    const cache = createReleasesCache({
      storage: () => {
        throw new Error('blocked');
      },
    });
    const request = vi.fn().mockResolvedValue(response);
    await cache.load('same', request);
    await expect(cache.load('same', request)).resolves.toEqual(response);
    expect(request).toHaveBeenCalledTimes(1);

    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    const fullCache = createReleasesCache({ storage: () => storage });
    await fullCache.load('same', request);
    await fullCache.load('same', request);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('bounds memory and persistent storage by evicting the least recently used response', async () => {
    const storage = memoryStorage();
    const cache = createReleasesCache({ storage: () => storage });
    const request = vi.fn().mockResolvedValue(response);
    for (let index = 0; index < 24; index += 1) await cache.load(String(index), request);
    await cache.load('0', request);
    await cache.load('24', request);
    const stored = JSON.parse(storage.getItem(RELEASES_CACHE_STORAGE_KEY) ?? '[]') as {
      key: string;
    }[];
    expect(stored).toHaveLength(24);
    expect(stored.map(({ key }) => key)).toContain('0');
    expect(stored.map(({ key }) => key)).not.toContain('1');
    await cache.load('1', request);
    expect(request).toHaveBeenCalledTimes(26);
  });

  it('bounds persisted payload size even when individual responses are large', async () => {
    const storage = memoryStorage();
    const cache = createReleasesCache({ storage: () => storage });
    const largeResponse = {
      ...response,
      data: [
        {
          id: 1,
          slug: 'game',
          name: 'a'.repeat(500_000),
          coverUrl: null,
          releaseDate: '2026-11-05',
          platforms: [{ id: 6, name: 'PC', abbreviation: 'PC' }],
          genres: [],
        },
      ],
    };
    const request = vi.fn().mockResolvedValue(largeResponse);
    await cache.load('large', request);
    expect(storage.getItem(RELEASES_CACHE_STORAGE_KEY)?.length).toBeLessThanOrEqual(500_000);
    await cache.load('large', request);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
