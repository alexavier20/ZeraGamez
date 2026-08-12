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
  readonly load: (query: ReleasesClientQuery, signal: AbortSignal) => Promise<ReleasesResponse>;
  readonly logger: Pick<Console, 'info' | 'error'>;
}

export interface ReleasesFilters {
  readonly platformIds?: readonly number[];
  readonly genreIds?: readonly number[];
}

function idsFromKey(key: string): number[] {
  return key === '' ? [] : key.split(',').map(Number);
}

function filtersFromKeys(platformIdsKey: string, genreIdsKey: string): ReleasesClientQuery {
  const platformIds = idsFromKey(platformIdsKey);
  const genreIds = idsFromKey(genreIdsKey);
  return {
    ...(platformIds.length > 0 ? { platformIds } : {}),
    ...(genreIds.length > 0 ? { genreIds } : {}),
  };
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
  filters: ReleasesFilters = {},
  dependencies: ReleasesDependencies = defaultDependencies,
): UseReleasesResult {
  const { load, logger } = dependencies;
  const platformIdsKey = filters.platformIds?.join(',') ?? '';
  const genreIdsKey = filters.genreIds?.join(',') ?? '';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReleasesState>({ status: 'loading' });
  const [pagination, setPagination] = useState<ReleasesPagination>({ status: 'idle' });
  const responseRef = useRef<ReleasesResponse | null>(null);
  const horizonRef = useRef<string | null>(null);
  const pendingWindowsRef = useRef<ReleaseWindow[]>([]);
  const failedWindowRef = useRef<ReleaseWindow | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const sessionRef = useRef(0);
  const loadRef = useRef(load);
  const loggerRef = useRef(logger);
  const filtersRef = useRef<ReleasesClientQuery>({});

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
          const response = responseRef.current;
          if (response?.data.length === 0) {
            setState({ status: 'empty', response });
          }
          setPagination({ status: 'complete' });
          return;
        }

        requestWindow = window;
        const controller = new AbortController();
        activeControllerRef.current = controller;
        const page = await loadRef.current(
          { ...window, ...filtersRef.current, limit: PAGE_LIMIT },
          controller.signal,
        );
        if (sessionRef.current !== session) return;

        if (isReleaseWindowIncomplete(page)) {
          const halves = splitReleaseWindow(window);
          if (!halves) {
            failedWindowRef.current = window;
            const error = { status: 0, code: 'INTERNAL_ERROR' } as const;
            if ((responseRef.current?.data.length ?? 0) === 0) {
              setState({ status: 'error', error });
            }
            setPagination({
              status: 'error',
              error,
            });
            return;
          }
          pendingWindowsRef.current.unshift(...halves);
          requestWindow = null;
          continue;
        }

        responseRef.current = mergeReleaseResponses(responseRef.current, page);
        const hasItems = responseRef.current.data.length > 0;
        if (hasItems) {
          setState({ status: 'success', response: responseRef.current });
        }

        if (pendingWindowsRef.current.length === 0) {
          const horizon = horizonRef.current;
          const next = horizon ? nextReleaseWindow(window.to, horizon) : null;
          if (next) pendingWindowsRef.current.push(next);
        }

        if (hasItems) {
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
      if ((responseRef.current?.data.length ?? 0) === 0) {
        setState({ status: 'error', error: normalized });
      }
      setPagination({ status: 'error', error: normalized });
    } finally {
      if (sessionRef.current === session) {
        activeControllerRef.current = null;
        inFlightRef.current = false;
      }
    }
  }, []);

  const loadMore = useCallback(() => {
    if (failedWindowRef.current) return;
    void consumePendingWindow(sessionRef.current);
  }, [consumePendingWindow]);

  const retryMore = useCallback(() => {
    if (inFlightRef.current) return;
    const failedWindow = failedWindowRef.current;
    if (!failedWindow) return;
    failedWindowRef.current = null;
    pendingWindowsRef.current.unshift(failedWindow);
    if ((responseRef.current?.data.length ?? 0) === 0) {
      setState({ status: 'loading' });
    }
    void consumePendingWindow(sessionRef.current);
  }, [consumePendingWindow]);

  useEffect(() => {
    const sessionFilters = filtersFromKeys(platformIdsKey, genreIdsKey);
    filtersRef.current = sessionFilters;
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    responseRef.current = null;
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
          const page = await load({ ...sessionFilters, limit: PAGE_LIMIT }, controller.signal);
          if (sessionRef.current !== session) return;

          loggerRef.current.info('[releases] Próximos lançamentos', page);
          horizonRef.current = createReleaseHorizon(page.meta.from);
          const initialWindow = { from: page.meta.from, to: page.meta.to };

          if (isReleaseWindowIncomplete(page)) {
            const halves = splitReleaseWindow(initialWindow);
            if (!halves) {
              failedWindowRef.current = initialWindow;
              const error = { status: 0, code: 'INTERNAL_ERROR' } as const;
              setState({ status: 'error', error });
              setPagination({
                status: 'error',
                error,
              });
              return;
            }
            pendingWindowsRef.current.unshift(...halves);
            activeControllerRef.current = null;
            inFlightRef.current = false;
            await consumePendingWindow(session);
            return;
          }

          responseRef.current = mergeReleaseResponses(null, page);
          const next = nextReleaseWindow(page.meta.to, horizonRef.current);
          if (next) pendingWindowsRef.current.push(next);

          if (page.data.length > 0) {
            setState({ status: 'success', response: responseRef.current });
            setPagination(next ? { status: 'idle' } : { status: 'complete' });
            return;
          }

          if (!next) {
            setState({ status: 'empty', response: responseRef.current });
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
  }, [attempt, consumePendingWindow, genreIdsKey, load, platformIdsKey]);

  const retry = useCallback(() => {
    if (failedWindowRef.current) {
      retryMore();
      return;
    }

    activeControllerRef.current?.abort();
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, [retryMore]);

  return { loadMore, pagination, retry, retryMore, state };
}
