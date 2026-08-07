import { describe, expect, it, vi } from 'vitest';

import { fetchReleases } from './releases-client';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

const payload: ReleasesResponse = {
  data: [],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 0,
    limit: 50,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('fetchReleases', () => {
  it('requests the default route and returns a validated DTO', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload));

    await expect(fetchReleases({}, { fetcher })).resolves.toEqual(payload);
    expect(fetcher).toHaveBeenCalledWith('/api/releases', {
      headers: { Accept: 'application/json' },
      signal: undefined,
    });
  });

  it('serializes filters in fixed order and forwards the exact AbortSignal', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload));
    const controller = new AbortController();

    await fetchReleases(
      {
        from: '2026-08-10',
        to: '2026-08-20',
        limit: 25,
        platformIds: [6, 167],
        genreIds: [12],
      },
      { fetcher, signal: controller.signal },
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      '/api/releases?from=2026-08-10&to=2026-08-20&limit=25&platforms=6%2C167&genres=12',
    );
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('omits empty platform and genre filters from the query', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload));

    await fetchReleases({ platformIds: [], genreIds: [] }, { fetcher });

    expect(fetcher).toHaveBeenCalledWith('/api/releases', {
      headers: { Accept: 'application/json' },
      signal: undefined,
    });
  });

  it('rejects an invalid successful DTO without exposing it', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: 'raw invalid payload' }));

    await expect(fetchReleases({}, { fetcher })).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_UPSTREAM_RESPONSE',
      message: 'Resposta inválida.',
    });
  });

  it('preserves only a validated public API error', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(
          { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviço indisponível.' } },
          503,
        ),
      );

    await expect(fetchReleases({}, { fetcher })).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Serviço indisponível.',
    });
  });

  it('maps a non-JSON successful body to an invalid upstream response', async () => {
    const response = {
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('raw parser detail')),
    } as unknown as Response;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(fetchReleases({}, { fetcher })).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_UPSTREAM_RESPONSE',
      message: 'Resposta inválida.',
    });
  });

  it('normalizes a non-JSON error body without exposing parser details', async () => {
    const response = {
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new Error('raw secret')),
    } as unknown as Response;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(fetchReleases({}, { fetcher })).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida.',
    });
  });

  it('preserves an AbortError-shaped rejection while reading the response body', async () => {
    const abortError = Object.assign(new Error('raw abort detail'), { name: 'AbortError' });
    const response = {
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(abortError),
    } as unknown as Response;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(fetchReleases({}, { fetcher })).rejects.toBe(abortError);
  });

  it('normalizes fetch rejections without exposing the upstream message', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('raw network secret'));

    await expect(fetchReleases({}, { fetcher })).rejects.toMatchObject({
      status: 0,
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível carregar lançamentos.',
    });
  });

  it('preserves AbortError so consumers can ignore cancellation', async () => {
    const abortError = new DOMException('request aborted', 'AbortError');
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(abortError);

    await expect(fetchReleases({}, { fetcher })).rejects.toBe(abortError);
  });
});
