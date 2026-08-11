import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchReleases,
  ReleasesClientError,
  type ReleasesClientQuery,
} from '../api/releases-client';
import {
  createReleaseHorizon,
  isReleaseWindowIncomplete,
  mergeReleaseResponses,
  nextReleaseWindow,
  PAGE_LIMIT,
  splitReleaseWindow,
  type ReleaseWindow,
} from '../model/release-pagination';

import type { ApiErrorCode, ReleasesResponse } from '../../../../shared/contracts/releases';

export type ReleasesState =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly response: ReleasesResponse }
  | { readonly status: 'empty'; readonly response: ReleasesResponse }
  | {
      readonly status: 'error';
      readonly error: { readonly status: number; readonly code: ApiErrorCode };
    };

export type ReleasesPagination =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'error';
      readonly error: { readonly status: number; readonly code: ApiErrorCode };
    }
  | { readonly status: 'complete' };

export interface UseReleasesResult {
  readonly state: ReleasesState;
  readonly pagination: ReleasesPagination;
  readonly retry: () => void;
  readonly loadMore: () => void;
  readonly retryMore: () => void;
}

export interface ReleasesDependencies {
  readonly load: (
    query: ReleasesClientQuery,
    signal: AbortSignal,
  ) => Promise<ReleasesResponse>;
  readonly logger: Pick<Console, 'info' | 'error'>;
}

const defaultDependencies: ReleasesDependencies = {
  load: (query, signal) => fetchReleases(query, { signal }),
  logger: console,
};

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

function normalizeError(error: unknown): { status: number; code: ApiErrorCode } {
  if (error instanceof ReleasesClientError) {
    return { status: error.status, code: error.code };
  }

  return { status: 0, code: 'INTERNAL_ERROR' };
}

export function useReleases(
  dependencies: ReleasesDependencies = defaultDependencies,
): UseReleasesResult {
  const { load, logger } = dependencies;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReleasesState>({ status: 'loading' });
  const [pagination, setPagination] = useState<ReleasesPagination>({ status: 'idle' });
  const responseRef = useRef<ReleasesResponse | null>(null);
  const firstResponseRef = useRef<ReleasesResponse | null>(null);
  const horizonRef = useRef<string | null>(null);
  const pendingWindowsRef = useRef<ReleaseWindow[]>([]);
  const failedWindowRef = useRef<ReleaseWindow | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const sessionRef = useRef(0);
  const loadRef = useRef(load);
  const loggerRef = useRef(logger);

  useEffect(() => {
    loadRef.current = load;
    loggerRef.current = logger;
  }, [load, logger]);

  const consumePendingWindow = useCallback(async (session: number): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPagination({ status: 'loading' });
    let requestWindow: ReleaseWindow | null = null;

    try {
      while (sessionRef.current === session) {
        const window = pendingWindowsRef.current.shift();
        if (!window) {
          if (responseRef.current === null && firstResponseRef.current) {
            const first = firstResponseRef.current;
            const empty = mergeReleaseResponses(null, {
              ...first,
              data: [],
              meta: {
                ...first.meta,
                count: 0,
                limit: PAGE_LIMIT,
                sourceTruncated: false,
              },
            });
            setState({ status: 'empty', response: empty });
          }
          setPagination({ status: 'complete' });
          return;
        }

        requestWindow = window;
        const controller = new AbortController();
        activeControllerRef.current = controller;
        const page = await loadRef.current(
          { ...window, limit: PAGE_LIMIT },
          controller.signal,
        );
        if (sessionRef.current !== session) return;

        if (isReleaseWindowIncomplete(page)) {
          const halves = splitReleaseWindow(window);
          if (!halves) {
            failedWindowRef.current = window;
            setPagination({
              status: 'error',
              error: { status: 0, code: 'INTERNAL_ERROR' },
            });
            return;
          }
          pendingWindowsRef.current.unshift(...halves);
          requestWindow = null;
          continue;
        }

        const hadItems = page.data.length > 0;
        if (hadItems) {
          responseRef.current = mergeReleaseResponses(responseRef.current, page);
          setState({ status: 'success', response: responseRef.current });
        }

        if (pendingWindowsRef.current.length === 0) {
          const horizon = horizonRef.current;
          const next = horizon ? nextReleaseWindow(window.to, horizon) : null;
          if (next) pendingWindowsRef.current.push(next);
        }

        if (hadItems) {
          setPagination(
            pendingWindowsRef.current.length > 0 ? { status: 'idle' } : { status: 'complete' },
          );
          return;
        }
        requestWindow = null;
      }
    } catch (error: unknown) {
      if (sessionRef.current !== session || isAbortError(error)) return;
      failedWindowRef.current = requestWindow;
      const normalized = normalizeError(error);
      loggerRef.current.error('[releases] Falha ao carregar mais lançamentos', normalized);
      setPagination({ status: 'error', error: normalized });
    } finally {
      if (sessionRef.current === session) {
        activeControllerRef.current = null;
        inFlightRef.current = false;
      }
    }
  }, []);

  const loadMore = useCallback(() => {
    void consumePendingWindow(sessionRef.current);
  }, [consumePendingWindow]);

  const retryMore = useCallback(() => {
    if (inFlightRef.current) return;
    const failedWindow = failedWindowRef.current;
    if (!failedWindow) return;
    failedWindowRef.current = null;
    pendingWindowsRef.current.unshift(failedWindow);
    void consumePendingWindow(sessionRef.current);
  }, [consumePendingWindow]);

  useEffect(() => {
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    responseRef.current = null;
    firstResponseRef.current = null;
    horizonRef.current = null;
    pendingWindowsRef.current = [];
    failedWindowRef.current = null;
    inFlightRef.current = true;

    queueMicrotask(() => {
      if (sessionRef.current !== session) return;
      setState({ status: 'loading' });
      setPagination({ status: 'idle' });

      void (async () => {
        const controller = new AbortController();
        activeControllerRef.current = controller;
        try {
          const page = await load({ limit: PAGE_LIMIT }, controller.signal);
          if (sessionRef.current !== session) return;

          loggerRef.current.info('[releases] Próximos lançamentos', page);
          firstResponseRef.current = page;
          horizonRef.current = createReleaseHorizon(page.meta.from);
          const initialWindow = { from: page.meta.from, to: page.meta.to };

          if (isReleaseWindowIncomplete(page)) {
            const halves = splitReleaseWindow(initialWindow);
            if (!halves) {
              failedWindowRef.current = initialWindow;
              setPagination({
                status: 'error',
                error: { status: 0, code: 'INTERNAL_ERROR' },
              });
              return;
            }
            pendingWindowsRef.current.unshift(...halves);
            activeControllerRef.current = null;
            inFlightRef.current = false;
            await consumePendingWindow(session);
            return;
          }

          const next = nextReleaseWindow(page.meta.to, horizonRef.current);
          if (next) pendingWindowsRef.current.push(next);

          if (page.data.length > 0) {
            responseRef.current = mergeReleaseResponses(null, page);
            setState({ status: 'success', response: responseRef.current });
            setPagination(next ? { status: 'idle' } : { status: 'complete' });
            return;
          }

          if (!next) {
            responseRef.current = null;
            const empty = mergeReleaseResponses(null, page);
            setState({ status: 'empty', response: empty });
            setPagination({ status: 'complete' });
            return;
          }

          activeControllerRef.current = null;
          inFlightRef.current = false;
          await consumePendingWindow(session);
        } catch (error: unknown) {
          if (sessionRef.current !== session || isAbortError(error)) return;

          const normalized = normalizeError(error);
          loggerRef.current.error('[releases] Falha ao carregar lançamentos', normalized);
          setState({ status: 'error', error: normalized });
        } finally {
          if (sessionRef.current === session) {
            activeControllerRef.current = null;
            inFlightRef.current = false;
          }
        }
      })();
    });

    return () => {
      if (sessionRef.current === session) sessionRef.current += 1;
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
      inFlightRef.current = false;
    };
  }, [attempt, consumePendingWindow, load]);

  const retry = useCallback(() => {
    activeControllerRef.current?.abort();
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return { loadMore, pagination, retry, retryMore, state };
}
