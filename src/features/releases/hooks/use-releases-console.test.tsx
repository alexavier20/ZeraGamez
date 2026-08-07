import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ReleasesClientError } from '../api/releases-client';

import { useReleasesConsole } from './use-releases-console';

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

describe('useReleasesConsole', () => {
  it('logs one successful response in StrictMode', async () => {
    const request = deferred<ReleasesResponse>();
    const log = logger();
    const dependencies = { load: vi.fn(() => request.promise), logger: log };

    renderHook(
      () => {
        useReleasesConsole(dependencies);
      },
      { wrapper: StrictWrapper },
    );
    await act(async () => {
      request.resolve(payload);
      await request.promise;
    });

    await waitFor(() => {
      expect(log.info).toHaveBeenCalledWith('[releases] Próximos lançamentos', payload);
    });
    expect(log.info).toHaveBeenCalledTimes(1);
  });

  it('aborts on unmount and suppresses a later successful settlement', async () => {
    const request = deferred<ReleasesResponse>();
    const log = logger();
    const load = vi.fn<(signal: AbortSignal) => Promise<ReleasesResponse>>();
    load.mockReturnValue(request.promise);
    const { unmount } = renderHook(() => {
      useReleasesConsole({ load, logger: log });
    });
    const signal = load.mock.calls.at(0)?.[0];

    expect(signal).toBeDefined();
    unmount();

    expect(signal?.aborted).toBe(true);
    await act(async () => {
      request.resolve(payload);
      await request.promise;
    });
    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('suppresses a later rejected settlement after unmount', async () => {
    const request = deferred<ReleasesResponse>();
    const log = logger();
    const { unmount } = renderHook(() => {
      useReleasesConsole({ load: vi.fn(() => request.promise), logger: log });
    });

    unmount();

    await act(async () => {
      request.reject(new Error('secret'));
      await request.promise.catch(() => undefined);
    });
    expect(log.error).not.toHaveBeenCalled();
  });

  it.each([
    [
      new ReleasesClientError(503, 'SERVICE_UNAVAILABLE', 'secret'),
      { status: 503, code: 'SERVICE_UNAVAILABLE' },
    ],
    [new Error('secret'), { status: 0, code: 'INTERNAL_ERROR' }],
  ] as const)(
    'logs one normalized error without exposing its message',
    async (error, normalized) => {
      const log = logger();

      renderHook(
        () => {
          useReleasesConsole({
            load: vi.fn().mockRejectedValue(error),
            logger: log,
          });
        },
        { wrapper: StrictWrapper },
      );

      await waitFor(() => {
        expect(log.error).toHaveBeenCalledWith(
          '[releases] Falha ao carregar lançamentos',
          normalized,
        );
      });
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(log.error.mock.calls)).not.toContain('secret');
    },
  );

  it('ignores AbortError', async () => {
    const log = logger();

    renderHook(() => {
      useReleasesConsole({
        load: vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')),
        logger: log,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('ignores a non-DOMException AbortError-shaped rejection', async () => {
    const log = logger();
    const abortError = Object.assign(new Error('raw abort detail'), { name: 'AbortError' });

    renderHook(() => {
      useReleasesConsole({
        load: vi.fn().mockRejectedValue(abortError),
        logger: log,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });
});
