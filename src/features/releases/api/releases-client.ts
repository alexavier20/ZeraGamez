import {
  apiErrorResponseSchema,
  releasesResponseSchema,
  type ApiErrorCode,
  type ReleasesResponse,
} from '../../../../shared/contracts/releases';

export interface ReleasesClientQuery {
  from?: string;
  to?: string;
  limit?: number;
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

function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function fetchReleases(
  query: ReleasesClientQuery = {},
  options: ReleasesClientOptions = {},
): Promise<ReleasesResponse> {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.platformIds) params.set('platforms', query.platformIds.join(','));
  if (query.genreIds) params.set('genres', query.genreIds.join(','));

  const suffix = params.size > 0 ? `?${params.toString()}` : '';

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`/api/releases${suffix}`, {
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
  } catch {
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
