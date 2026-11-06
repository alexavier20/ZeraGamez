import {
  apiErrorResponseSchema,
  releasesResponseSchema,
  type ApiErrorCode,
  type ReleasesResponse,
} from '../../../../shared/contracts/releases';
import { todayInSaoPaulo } from '../model/release-calendar';

import { createReleasesCache } from './releases-cache';

const releasesCache = createReleasesCache();

export interface ReleasesClientQuery {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  platformIds?: number[];
  genreIds?: number[];
}

interface ReleasesClientOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export class ReleasesClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function isAbortError(error: unknown): error is { name: 'AbortError' } {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

export async function fetchReleases(
  query: ReleasesClientQuery = {},
  options: ReleasesClientOptions = {},
): Promise<ReleasesResponse> {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined && query.offset > 0) {
    params.set('offset', String(query.offset));
  }
  if (query.platformIds && query.platformIds.length > 0) {
    params.set('platforms', [...query.platformIds].sort((left, right) => left - right).join(','));
  }
  if (query.genreIds && query.genreIds.length > 0) {
    params.set('genres', [...query.genreIds].sort((left, right) => left - right).join(','));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  const url = `/api/releases${suffix}`;

  // Custom transports stay isolated from the browser's shared production cache.
  if (options.fetcher) return requestReleases(url, options);
  const key = `${todayInSaoPaulo()}:${url}`;
  return releasesCache.load(key, (signal) => requestReleases(url, { signal }), options.signal);
}

async function requestReleases(
  url: string,
  options: ReleasesClientOptions,
): Promise<ReleasesResponse> {
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url, {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    throw new ReleasesClientError(0, 'INTERNAL_ERROR', 'Não foi possível carregar lançamentos.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    if (response.ok) {
      throw new ReleasesClientError(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta inválida.');
    }
    throw new ReleasesClientError(response.status, 'INTERNAL_ERROR', 'Resposta inválida.');
  }

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload);
    if (!parsedError.success) {
      throw new ReleasesClientError(response.status, 'INTERNAL_ERROR', 'Resposta inválida.');
    }
    throw new ReleasesClientError(
      response.status,
      parsedError.data.error.code,
      parsedError.data.error.message,
    );
  }

  const parsedResponse = releasesResponseSchema.safeParse(payload);
  if (!parsedResponse.success) {
    throw new ReleasesClientError(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta inválida.');
  }

  return parsedResponse.data;
}
