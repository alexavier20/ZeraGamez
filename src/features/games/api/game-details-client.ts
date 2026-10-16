import {
  gameDetailsResponseSchema,
  type GameDetails,
} from '../../../../shared/contracts/game-details';
import { apiErrorResponseSchema, type ApiErrorCode } from '../../../../shared/contracts/releases';

interface GameDetailsClientOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export class GameDetailsClientError extends Error {
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

export async function fetchGameDetails(
  id: number,
  options: GameDetailsClientOptions = {},
): Promise<GameDetails> {
  let response: Response;
  try {
    const params = new URLSearchParams({ id: String(id) });
    response = await (options.fetcher ?? fetch)(`/api/games?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    throw new GameDetailsClientError(0, 'INTERNAL_ERROR', 'Não foi possível carregar o jogo.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    if (response.ok) {
      throw new GameDetailsClientError(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta inválida.');
    }
    throw new GameDetailsClientError(response.status, 'INTERNAL_ERROR', 'Resposta inválida.');
  }

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload);
    if (!parsedError.success) {
      throw new GameDetailsClientError(response.status, 'INTERNAL_ERROR', 'Resposta inválida.');
    }
    throw new GameDetailsClientError(
      response.status,
      parsedError.data.error.code,
      parsedError.data.error.message,
    );
  }

  const parsedResponse = gameDetailsResponseSchema.safeParse(payload);
  if (!parsedResponse.success) {
    throw new GameDetailsClientError(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta inválida.');
  }
  return parsedResponse.data.data;
}
