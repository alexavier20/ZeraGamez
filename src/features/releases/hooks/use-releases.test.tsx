import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ReleasesClientError } from '../api/releases-client';

import { useReleases, type ReleasesDependencies, type ReleasesState } from './use-releases';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

type ReleaseItem = ReleasesResponse['data'][number];

function release(id: number, releaseDate: string): ReleaseItem {
  return {
    id,
    slug: `game-${String(id)}`,
    name: `Game ${String(id)}`,
    coverUrl: `https://images.example.com/game-${String(id)}.jpg`,
    releaseDate,
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
    genres: [{ id: 12, name: 'Role-playing (RPG)' }],
  };
}

function page(data: ReleaseItem[], meta: Partial<ReleasesResponse['meta']> = {}): ReleasesResponse {
  return {
    data,
    meta: {
      from: '2026-08-11',
      to: '2026-11-09',
      count: data.length,
      limit: 100,
      generatedAt: '2026-08-11T12:00:00.000Z',
      sourceTruncated: false,
      ...meta,
    },
  };
}

const emptyResponse = page([]);

const completeEmptyResponse = page([], {
  from: '2024-08-11',
  to: '2026-08-11',
});

const responseWithOneRelease = page([release(1, '2026-08-14')]);

const nextResponse = page([release(2, '2026-11-10')], {
  from: '2026-11-10',
  to: '2027-02-08',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function logger() {
  return { info: vi.fn(), error: vi.fn() };
}

function successData(state: ReleasesState): ReleasesResponse['data'] {
  expect(state.status).toBe('success');
  if (state.status !== 'success') throw new Error('Expected releases success state');
  return state.response.data;
}

function successResponse(state: ReleasesState): ReleasesResponse {
  expect(state.status).toBe('success');
  if (state.status !== 'success') throw new Error('Expected releases success state');
  return state.response;
}

function StrictWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe('useReleases', () => {
  it('moves from loading to success and logs once in StrictMode', async () => {
    const load = vi.fn<ReleasesDependencies['load']>().mockResolvedValue(responseWithOneRelease);
    const log = logger();
    const { result } = renderHook(() => useReleases({ load, logger: log }), {
      wrapper: StrictWrapper,
    });
    const initialRetry = result.current.retry;
    const initialLoadMore = result.current.loadMore;
    const initialRetryMore = result.current.retryMore;

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    expect(result.current.retry).toBe(initialRetry);
    expect(result.current.loadMore).toBe(initialLoadMore);
    expect(result.current.retryMore).toBe(initialRetryMore);
    expect(result.current.pagination).toEqual({ status: 'idle' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ limit: 100 }, expect.any(AbortSignal));
    expect(log.info).toHaveBeenCalledWith(
      '[releases] Pr\u00f3ximos lan\u00e7amentos',
      responseWithOneRelease,
    );
    expect(log.info).toHaveBeenCalledTimes(1);
  });

  it('exposes empty when the validated response has no items', async () => {
    const load = vi.fn().mockResolvedValue(completeEmptyResponse);
    const log = logger();
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('empty');
    });
    expect(result.current.state).toEqual({ status: 'empty', response: completeEmptyResponse });
  });

  it('appends the next chronological window and ignores concurrent triggers', async () => {
    const second = deferred<ReleasesResponse>();
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(responseWithOneRelease)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    expect(load.mock.calls[1]?.[0]).toEqual({
      from: '2026-11-10',
      to: '2027-02-08',
      limit: 100,
    });
    expect(result.current.pagination).toEqual({ status: 'loading' });

    await act(async () => {
      second.resolve(nextResponse);
      await second.promise;
    });

    expect(successData(result.current.state).map(({ id }) => id)).toEqual([1, 2]);
    expect(result.current.pagination).toEqual({ status: 'idle' });
  });

  it('splits a saturated parent without appending it and loads halves chronologically', async () => {
    const saturated = page([], {
      from: '2026-08-11',
      to: '2026-08-20',
      count: 100,
      limit: 100,
    });
    const left = page([release(1, '2026-08-12')], {
      from: '2026-08-11',
      to: '2026-08-15',
    });
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(saturated)
      .mockResolvedValueOnce(left);

    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    expect(load.mock.calls.map(([query]) => query)).toEqual([
      { limit: 100 },
      { from: '2026-08-11', to: '2026-08-15', limit: 100 },
    ]);
    expect(successData(result.current.state)).toEqual(left.data);
  });

  it('discards provisional items from a saturated parent before appending a complete half', async () => {
    const saturated = page([release(99, '2026-08-14')], {
      from: '2026-08-11',
      to: '2026-08-20',
      count: 100,
    });
    const left = page([release(1, '2026-08-12')], {
      from: '2026-08-11',
      to: '2026-08-15',
    });
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(saturated)
      .mockResolvedValueOnce(left);
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    expect(successData(result.current.state).map(({ id }) => id)).toEqual([1]);
  });

  it('keeps split remainders sequential when incremental triggers race', async () => {
    const saturated = page([], {
      from: '2026-08-11',
      to: '2026-08-20',
      count: 100,
    });
    const saturatedLeft = page([], {
      from: '2026-08-11',
      to: '2026-08-15',
      count: 100,
    });
    const firstQuarter = page([release(1, '2026-08-12')], {
      from: '2026-08-11',
      to: '2026-08-13',
    });
    const secondQuarter = deferred<ReleasesResponse>();
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(saturated)
      .mockResolvedValueOnce(saturatedLeft)
      .mockResolvedValueOnce(firstQuarter)
      .mockReturnValueOnce(secondQuarter.promise)
      .mockResolvedValue(page([], { from: '2026-08-16', to: '2026-08-20' }));
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    expect(load).toHaveBeenCalledTimes(3);

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(4);
    });
    expect(load.mock.calls[3]?.[0]).toEqual({
      from: '2026-08-14',
      to: '2026-08-15',
      limit: 100,
    });

    await act(async () => {
      secondQuarter.resolve(
        page([release(2, '2026-08-14')], {
          from: '2026-08-14',
          to: '2026-08-15',
        }),
      );
      await secondQuarter.promise;
    });
    expect(successData(result.current.state).map(({ id }) => id)).toEqual([1, 2]);
  });

  it('skips empty windows until data is found', async () => {
    const initialEmptyPage = page([], {
      generatedAt: '2026-08-11T10:00:00.000Z',
    });
    const nextEmptyPage = page([], {
      from: '2026-11-10',
      to: '2027-02-08',
      generatedAt: '2026-11-10T10:00:00.000Z',
    });
    const laterPage = page([release(3, '2027-02-10')], {
      from: '2027-02-09',
      to: '2027-05-10',
      generatedAt: '2027-02-09T10:00:00.000Z',
    });
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(initialEmptyPage)
      .mockResolvedValueOnce(nextEmptyPage)
      .mockResolvedValueOnce(laterPage);

    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    expect(load).toHaveBeenCalledTimes(3);
    expect(successResponse(result.current.state)).toEqual({
      data: laterPage.data,
      meta: {
        from: '2026-08-11',
        to: '2027-05-10',
        count: 1,
        limit: 100,
        generatedAt: '2026-08-11T10:00:00.000Z',
        sourceTruncated: false,
      },
    });
  });

  it('stays loading while a later empty window is pending before final empty', async () => {
    const initialEmpty = page([], {
      from: '2024-08-11',
      to: '2026-05-12',
    });
    const finalEmpty = deferred<ReleasesResponse>();
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(initialEmpty)
      .mockReturnValueOnce(finalEmpty.promise);
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    expect(load.mock.calls[1]?.[0]).toEqual({
      from: '2026-05-13',
      to: '2026-08-11',
      limit: 100,
    });
    expect(result.current.state).toEqual({ status: 'loading' });
    expect(result.current.pagination).toEqual({ status: 'loading' });

    await act(async () => {
      finalEmpty.resolve(
        page([], {
          from: '2026-05-13',
          to: '2026-08-11',
          generatedAt: '2026-05-13T10:00:00.000Z',
        }),
      );
      await finalEmpty.promise;
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('empty');
    });
    expect(result.current.state).toEqual({
      status: 'empty',
      response: {
        data: [],
        meta: {
          from: '2024-08-11',
          to: '2026-08-11',
          count: 0,
          limit: 100,
          generatedAt: '2026-08-11T12:00:00.000Z',
          sourceTruncated: false,
        },
      },
    });
    expect(result.current.pagination).toEqual({ status: 'complete' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the accumulated response when a later window fails', async () => {
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(responseWithOneRelease)
      .mockRejectedValueOnce(new ReleasesClientError(503, 'SERVICE_UNAVAILABLE', 'secret'));
    const log = logger();
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    const beforeError = successResponse(result.current.state);

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.pagination.status).toBe('error');
    });

    expect(successResponse(result.current.state)).toBe(beforeError);
    expect(result.current.pagination).toEqual({
      status: 'error',
      error: { status: 503, code: 'SERVICE_UNAVAILABLE' },
    });
    expect(log.error).toHaveBeenCalledWith('[releases] Falha ao carregar mais lançamentos', {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('secret');
  });

  it('exposes a scan error before any items and retries the exact failed window', async () => {
    const failedQuery = {
      from: '2026-11-10',
      to: '2027-02-08',
      limit: 100,
    };
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(emptyResponse)
      .mockRejectedValueOnce(new ReleasesClientError(503, 'SERVICE_UNAVAILABLE', 'secret'))
      .mockResolvedValueOnce(nextResponse);
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    expect(result.current.state).toEqual({
      status: 'error',
      error: { status: 503, code: 'SERVICE_UNAVAILABLE' },
    });
    expect(result.current.pagination).toEqual({
      status: 'error',
      error: { status: 503, code: 'SERVICE_UNAVAILABLE' },
    });
    expect(load.mock.calls[1]?.[0]).toEqual(failedQuery);

    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    expect(load.mock.calls[2]?.[0]).toEqual(failedQuery);
    expect(successData(result.current.state)).toEqual(nextResponse.data);
  });

  it('retries only the exact failed window and appends its success', async () => {
    const failedQuery = {
      from: '2026-11-10',
      to: '2027-02-08',
      limit: 100,
    };
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(responseWithOneRelease)
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(nextResponse);
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    const beforeError = successResponse(result.current.state);
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.pagination.status).toBe('error');
    });
    expect(successResponse(result.current.state)).toBe(beforeError);
    const failedPagination = result.current.pagination;

    act(() => {
      result.current.loadMore();
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls.at(-1)?.[0]).toEqual(failedQuery);
    expect(result.current.pagination).toBe(failedPagination);

    act(() => {
      result.current.retryMore();
    });
    await waitFor(() => {
      expect(result.current.pagination.status).toBe('idle');
    });
    expect(load.mock.calls.at(-1)?.[0]).toEqual(failedQuery);
    expect(load).toHaveBeenCalledTimes(3);
    expect(successData(result.current.state).map(({ id }) => id)).toEqual([1, 2]);
  });

  it('completes at an empty final window without requesting beyond the horizon', async () => {
    const initial = page([release(1, '2028-05-12')], {
      to: '2028-05-12',
    });
    const finalEmpty = page([], {
      from: '2028-05-13',
      to: '2028-08-10',
    });
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(finalEmpty);
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.pagination.status).toBe('complete');
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1]?.[0]).toEqual({
      from: '2028-05-13',
      to: '2028-08-10',
      limit: 100,
    });
    expect(successResponse(result.current.state)).toEqual({
      data: initial.data,
      meta: {
        from: '2026-08-11',
        to: '2028-08-10',
        count: 1,
        limit: 100,
        generatedAt: '2026-08-11T12:00:00.000Z',
        sourceTruncated: false,
      },
    });
  });

  it('exposes an initial error and retries the exact saturated one-day window', async () => {
    const saturatedDay = page([release(99, '2026-08-11')], {
      from: '2026-08-11',
      to: '2026-08-11',
      count: 100,
    });
    const load = vi.fn<ReleasesDependencies['load']>().mockResolvedValueOnce(saturatedDay);
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.pagination.status).toBe('error');
    });

    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({
      status: 'error',
      error: { status: 0, code: 'INTERNAL_ERROR' },
    });
    expect(result.current.pagination).toEqual({
      status: 'error',
      error: { status: 0, code: 'INTERNAL_ERROR' },
    });

    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    expect(load.mock.calls[1]?.[0]).toEqual({
      from: '2026-08-11',
      to: '2026-08-11',
      limit: 100,
    });
  });

  it('keeps accumulated data and retries the same incremental one-day saturation', async () => {
    const initial = page([release(1, '2026-08-10')], {
      from: '2024-08-11',
      to: '2026-08-10',
    });
    const saturatedDay = page([release(99, '2026-08-11')], {
      from: '2026-08-11',
      to: '2026-08-11',
      count: 100,
    });
    const failedQuery = {
      from: '2026-08-11',
      to: '2026-08-11',
      limit: 100,
    };
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(initial)
      .mockResolvedValue(saturatedDay);
    const { result } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    const accumulated = successResponse(result.current.state);

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.pagination.status).toBe('error');
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1]?.[0]).toEqual(failedQuery);
    expect(successResponse(result.current.state)).toBe(accumulated);
    expect(successData(result.current.state).map(({ id }) => id)).toEqual([1]);

    act(() => {
      result.current.retryMore();
    });
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(3);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(load.mock.calls.at(-1)?.[0]).toEqual(failedQuery);
    expect(successResponse(result.current.state)).toBe(accumulated);
    expect(result.current.pagination).toEqual({
      status: 'error',
      error: { status: 0, code: 'INTERNAL_ERROR' },
    });
  });

  it('normalizes an error and retries with a new request', async () => {
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockRejectedValueOnce(new ReleasesClientError(503, 'SERVICE_UNAVAILABLE', 'secret'))
      .mockResolvedValueOnce(responseWithOneRelease);
    const log = logger();
    const { result } = renderHook(() => useReleases({ load, logger: log }));
    const initialRetry = result.current.retry;

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    expect(result.current.state).toEqual({
      status: 'error',
      error: { status: 503, code: 'SERVICE_UNAVAILABLE' },
    });
    expect(result.current.retry).toBe(initialRetry);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('secret');
    expect(log.error).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });
    expect(result.current.state.status).toBe('loading');
    expect(result.current.retry).toBe(initialRetry);
    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    expect(result.current.retry).toBe(initialRetry);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('normalizes unexpected errors without exposing their messages in error logs', async () => {
    const log = logger();
    const load = vi.fn().mockRejectedValue(new Error('secret'));
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    expect(result.current.state).toEqual({
      status: 'error',
      error: { status: 0, code: 'INTERNAL_ERROR' },
    });
    expect(log.error).toHaveBeenCalledWith('[releases] Falha ao carregar lan\u00e7amentos', {
      status: 0,
      code: 'INTERNAL_ERROR',
    });
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('secret');
  });

  it('aborts on unmount and suppresses a later successful settlement', async () => {
    const request = deferred<ReleasesResponse>();
    const log = logger();
    const load = vi.fn<ReleasesDependencies['load']>().mockReturnValue(request.promise);
    const { unmount } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });
    const signal = load.mock.calls[0][1];
    expect(signal).toBeDefined();

    unmount();

    expect(signal.aborted).toBe(true);
    await act(async () => {
      request.resolve(responseWithOneRelease);
      await request.promise;
    });
    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('aborts an active incremental request on unmount and ignores its late success', async () => {
    const incremental = deferred<ReleasesResponse>();
    const log = logger();
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(responseWithOneRelease)
      .mockReturnValueOnce(incremental.promise);
    const { result, unmount } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    const incrementalSignal = load.mock.calls[1][1];
    const beforeUnmount = successResponse(result.current.state);

    unmount();

    expect(incrementalSignal.aborted).toBe(true);
    await act(async () => {
      incremental.resolve(nextResponse);
      await incremental.promise;
    });
    expect(successResponse(result.current.state)).toBe(beforeUnmount);
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('skips a scheduled request when cleanup occurs before its microtask', async () => {
    const load = vi.fn<ReleasesDependencies['load']>().mockResolvedValue(emptyResponse);
    const log = logger();
    const { unmount } = renderHook(() => useReleases({ load, logger: log }));

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(load).not.toHaveBeenCalled();
  });

  it('suppresses a later rejected settlement after unmount', async () => {
    const request = deferred<ReleasesResponse>();
    const log = logger();
    const load = vi.fn<ReleasesDependencies['load']>().mockReturnValue(request.promise);
    const { unmount } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });
    unmount();

    await act(async () => {
      request.reject(new Error('secret'));
      await request.promise.catch(() => undefined);
    });
    expect(log.error).not.toHaveBeenCalled();
  });

  it.each([
    new DOMException('aborted', 'AbortError'),
    Object.assign(new Error('raw abort detail'), { name: 'AbortError' }),
  ])('ignores AbortError-shaped rejections', async (abortError) => {
    const log = logger();
    const load = vi.fn().mockRejectedValue(abortError);
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('loading');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('aborts a pending request on retry and ignores its late settlement', async () => {
    const first = deferred<ReleasesResponse>();
    const second = deferred<ReleasesResponse>();
    const log = logger();
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });
    const firstSignal = load.mock.calls[0][1];

    act(() => {
      result.current.retry();
    });
    expect(firstSignal.aborted).toBe(true);
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      second.resolve(responseWithOneRelease);
      await second.promise;
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    await act(async () => {
      first.resolve(emptyResponse);
      await first.promise;
    });
    expect(result.current.state).toEqual({ status: 'success', response: responseWithOneRelease });
    expect(log.info).toHaveBeenCalledTimes(1);
  });

  it('replaces a session by aborting an incremental request and ignores its late rejection', async () => {
    const incremental = deferred<ReleasesResponse>();
    const log = logger();
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(responseWithOneRelease)
      .mockReturnValueOnce(incremental.promise)
      .mockResolvedValueOnce(responseWithOneRelease);
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    const incrementalSignal = load.mock.calls[1][1];

    act(() => {
      result.current.retry();
    });

    expect(incrementalSignal.aborted).toBe(true);
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    await act(async () => {
      incremental.reject(new Error('late secret'));
      await incremental.promise.catch(() => undefined);
    });
    expect(successData(result.current.state).map(({ id }) => id)).toEqual([1]);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('keeps the replacement controller active when the previous session settles late', async () => {
    const incremental = deferred<ReleasesResponse>();
    const replacement = deferred<ReleasesResponse>();
    const load = vi
      .fn<ReleasesDependencies['load']>()
      .mockResolvedValueOnce(responseWithOneRelease)
      .mockReturnValueOnce(incremental.promise)
      .mockReturnValueOnce(replacement.promise);
    const { result, unmount } = renderHook(() => useReleases({ load, logger: logger() }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });

    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(3);
    });
    const replacementSignal = load.mock.calls[2][1];

    await act(async () => {
      incremental.reject(new Error('late previous-session failure'));
      await incremental.promise.catch(() => undefined);
    });
    unmount();

    expect(replacementSignal.aborted).toBe(true);
    replacement.reject(new DOMException('aborted', 'AbortError'));
    await replacement.promise.catch(() => undefined);
  });
});
