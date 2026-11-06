import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

const payload: ReleasesResponse = {
  data: [],
  meta: {
    from: '2026-11-05',
    to: '2027-02-03',
    count: 0,
    limit: 100,
    generatedAt: '2026-11-05T12:00:00Z',
    sourceTruncated: false,
  },
};

describe('browser releases client cache', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    localStorage.removeItem('zeragamez:releases:v1');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('normalizes filter order, shares requests and keeps the caller arrays unchanged', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json(payload)));
    vi.stubGlobal('fetch', fetcher);
    const { fetchReleases } = await import('./releases-client');
    const platformIds = [167, 6];
    await Promise.all([
      fetchReleases({ platformIds, genreIds: [12, 5] }),
      fetchReleases({ platformIds: [6, 167], genreIds: [5, 12] }),
    ]);
    await fetchReleases({ platformIds: [6, 167], genreIds: [5, 12] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/releases?platforms=6%2C167&genres=5%2C12');
    expect(platformIds).toEqual([167, 6]);
  });

  it('restores the browser cache after the application module is reloaded', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json(payload)));
    vi.stubGlobal('fetch', fetcher);
    const firstClient = await import('./releases-client');
    await firstClient.fetchReleases({ limit: 100 });
    vi.resetModules();
    const reloadedClient = await import('./releases-client');
    await expect(reloadedClient.fetchReleases({ limit: 100 })).resolves.toEqual(payload);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refreshes at the São Paulo day boundary even within the 15-minute lifetime', async () => {
    vi.setSystemTime(new Date('2026-11-06T02:59:59Z'));
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json(payload)));
    vi.stubGlobal('fetch', fetcher);
    const { fetchReleases } = await import('./releases-client');
    await fetchReleases({ limit: 100 });
    vi.setSystemTime(new Date('2026-11-06T03:00:01Z'));
    await fetchReleases({ limit: 100 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not cache an invalid API response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: 'invalid' }))
      .mockResolvedValueOnce(Response.json(payload));
    vi.stubGlobal('fetch', fetcher);
    const { fetchReleases } = await import('./releases-client');
    await expect(fetchReleases()).rejects.toMatchObject({ code: 'INVALID_UPSTREAM_RESPONSE' });
    await expect(fetchReleases()).resolves.toEqual(payload);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('lets an incomplete single-day request retry the API instead of reusing its failure', async () => {
    const truncated = {
      ...payload,
      meta: { ...payload.meta, from: '2026-11-05', to: '2026-11-05', sourceTruncated: true },
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(truncated))
      .mockResolvedValueOnce(Response.json(payload));
    vi.stubGlobal('fetch', fetcher);
    const { fetchReleases } = await import('./releases-client');
    const query = { from: '2026-11-05', to: '2026-11-05' };
    await fetchReleases(query);
    await expect(fetchReleases(query)).resolves.toEqual(payload);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
