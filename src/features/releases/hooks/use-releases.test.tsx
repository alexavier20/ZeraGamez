import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ReleasesClientError } from '../api/releases-client';

import { useReleases } from './use-releases';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

const emptyResponse: ReleasesResponse = {
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

const responseWithOneRelease: ReleasesResponse = {
  ...emptyResponse,
  data: [
    {
      id: 1,
      slug: 'example-game',
      name: 'Example Game',
      coverUrl: 'https://images.example.com/example-game.jpg',
      releaseDate: '2026-08-14',
      platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
      genres: [{ id: 12, name: 'Role-playing (RPG)' }],
    },
  ],
  meta: { ...emptyResponse.meta, count: 1 },
};

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

function StrictWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe('useReleases', () => {
  it('moves from loading to success and logs once in StrictMode', async () => {
    const load = vi.fn().mockResolvedValue(responseWithOneRelease);
    const log = logger();
    const { result } = renderHook(() => useReleases({ load, logger: log }), {
      wrapper: StrictWrapper,
    });

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      '[releases] Pr\u00f3ximos lan\u00e7amentos',
      responseWithOneRelease,
    );
    expect(log.info).toHaveBeenCalledTimes(1);
  });

  it('exposes empty when the validated response has no items', async () => {
    const load = vi.fn().mockResolvedValue(emptyResponse);
    const log = logger();
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('empty');
    });
  });

  it('normalizes an error and retries with a new request', async () => {
    const load = vi
      .fn<(signal: AbortSignal) => Promise<ReleasesResponse>>()
      .mockRejectedValueOnce(new ReleasesClientError(503, 'SERVICE_UNAVAILABLE', 'secret'))
      .mockResolvedValueOnce(responseWithOneRelease);
    const log = logger();
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    expect(result.current.state).toEqual({
      status: 'error',
      error: { status: 503, code: 'SERVICE_UNAVAILABLE' },
    });
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('secret');

    act(() => {
      result.current.retry();
    });
    expect(result.current.state.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });
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
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('secret');
  });

  it('aborts on unmount and suppresses a later successful settlement', async () => {
    const request = deferred<ReleasesResponse>();
    const log = logger();
    const load = vi
      .fn<(signal: AbortSignal) => Promise<ReleasesResponse>>()
      .mockReturnValue(request.promise);
    const { unmount } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });
    const signal = load.mock.calls[0][0];
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

  it('skips a scheduled request when cleanup occurs before its microtask', async () => {
    const load = vi
      .fn<(signal: AbortSignal) => Promise<ReleasesResponse>>()
      .mockResolvedValue(emptyResponse);
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
    const load = vi
      .fn<(signal: AbortSignal) => Promise<ReleasesResponse>>()
      .mockReturnValue(request.promise);
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
      .fn<(signal: AbortSignal) => Promise<ReleasesResponse>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useReleases({ load, logger: log }));

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });
    const firstSignal = load.mock.calls[0][0];

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
});
