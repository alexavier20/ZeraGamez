import { useEffect } from 'react';

import { fetchReleases, ReleasesClientError } from '../api/releases-client';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

interface ReleasesConsoleDependencies {
  load: (signal: AbortSignal) => Promise<ReleasesResponse>;
  logger: Pick<Console, 'info' | 'error'>;
}

const defaultDependencies: ReleasesConsoleDependencies = {
  load: (signal) => fetchReleases({}, { signal }),
  logger: console,
};

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

function normalizeError(error: unknown) {
  if (error instanceof ReleasesClientError) {
    return { status: error.status, code: error.code };
  }
  return { status: 0, code: 'INTERNAL_ERROR' as const };
}

export function useReleasesConsole(
  dependencies: ReleasesConsoleDependencies = defaultDependencies,
) {
  const { load, logger } = dependencies;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void load(controller.signal)
      .then((response) => {
        if (active) logger.info('[releases] Próximos lançamentos', response);
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          logger.error('[releases] Falha ao carregar lançamentos', normalizeError(error));
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [load, logger]);
}
