import {
  gameSearchResponseSchema,
  type GameSearchResult,
} from '../../../../shared/contracts/game-search';
import { apiErrorResponseSchema, type ApiErrorCode } from '../../../../shared/contracts/releases';

interface GameSearchClientOptions {
  readonly fetcher?: typeof fetch;
  readonly signal?: AbortSignal;
}

export class GameSearchClientError extends Error {
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

async function fetchGames(
  params: URLSearchParams,
  options: GameSearchClientOptions,
): Promise<readonly GameSearchResult[]> {
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`/api/game-search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    throw new GameSearchClientError(0, 'INTERNAL_ERROR', 'Não foi possível buscar jogos.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    if (response.ok) {
      throw new GameSearchClientError(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta inválida.');
    }
    throw new GameSearchClientError(response.status, 'INTERNAL_ERROR', 'Resposta inválida.');
  }

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload);
    if (!parsedError.success) {
      throw new GameSearchClientError(response.status, 'INTERNAL_ERROR', 'Resposta inválida.');
    }
    throw new GameSearchClientError(
      response.status,
      parsedError.data.error.code,
      parsedError.data.error.message,
    );
  }

  const parsedResponse = gameSearchResponseSchema.safeParse(payload);
  if (!parsedResponse.success) {
    throw new GameSearchClientError(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta inválida.');
  }
  return parsedResponse.data.data;
}

export function searchGames(
  query: string,
  options: GameSearchClientOptions = {},
): Promise<readonly GameSearchResult[]> {
  return fetchGames(new URLSearchParams({ q: query.trim() }), options);
}

export function getMostAnticipatedGames(
  options: GameSearchClientOptions = {},
): Promise<readonly GameSearchResult[]> {
  return fetchGames(new URLSearchParams({ mode: 'anticipated' }), options);
}

export function getTopHypedGames(
  options: GameSearchClientOptions = {},
): Promise<readonly GameSearchResult[]> {
  return fetchGames(new URLSearchParams({ mode: 'top-hyped' }), options);
}
