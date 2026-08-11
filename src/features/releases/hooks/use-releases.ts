import { useCallback, useEffect, useState } from 'react';

import { fetchReleases, ReleasesClientError } from '../api/releases-client';

import type { ApiErrorCode, ReleasesResponse } from '../../../../shared/contracts/releases';

export type ReleasesState =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly response: ReleasesResponse }
  | { readonly status: 'empty'; readonly response: ReleasesResponse }
  | {
      readonly status: 'error';
      readonly error: { readonly status: number; readonly code: ApiErrorCode };
    };

export interface UseReleasesResult {
  readonly state: ReleasesState;
  readonly retry: () => void;
}

export interface ReleasesDependencies {
  readonly load: (signal: AbortSignal) => Promise<ReleasesResponse>;
  readonly logger: Pick<Console, 'info' | 'error'>;
}

const defaultDependencies: ReleasesDependencies = {
  load: (signal) => fetchReleases({}, { signal }),
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

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      void load(controller.signal)
        .then((response) => {
          if (!active) return;

          logger.info('[releases] Pr\u00f3ximos lan\u00e7amentos', response);
          setState(
            response.data.length === 0
              ? { status: 'empty', response }
              : { status: 'success', response },
          );
        })
        .catch((error: unknown) => {
          if (!active || isAbortError(error)) return;

          const normalized = normalizeError(error);
          logger.error('[releases] Falha ao carregar lan\u00e7amentos', normalized);
          setState({ status: 'error', error: normalized });
        });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, load, logger]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return { retry, state };
}
