import {
  InvalidGameSearchQueryError,
  parseGameSearchQuery,
} from '../server/games/application/game-search-query';
import { searchGames } from '../server/games/application/search-games';
import { IgdbGameSearchRepository } from '../server/games/infrastructure/igdb-game-search-repository';
import { readIgdbEnvironment } from '../server/releases/infrastructure/env';
import { TwitchTokenProvider } from '../server/releases/infrastructure/twitch-token-provider';
import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from '../server/releases/infrastructure/upstream-errors';
import { gameSearchResponseSchema } from '../shared/contracts/game-search';
import { apiErrorResponseSchema, type ApiErrorCode } from '../shared/contracts/releases';

const successHeaders = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  'Content-Type': 'application/json; charset=utf-8',
  'Vercel-CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
};

const errorHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export interface GameSearchHandlerDependencies {
  search(query: string): ReturnType<typeof searchGames>;
}

function json(payload: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(status: number, code: ApiErrorCode, message: string) {
  const payload = apiErrorResponseSchema.parse({ error: { code, message } });
  return json(payload, status, errorHeaders);
}

export async function handleGameSearchRequest(
  request: Request,
  dependencies: GameSearchHandlerDependencies,
) {
  if (request.method !== 'GET') {
    const response = errorResponse(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    response.headers.set('Allow', 'GET');
    return response;
  }

  try {
    const query = parseGameSearchQuery(new URL(request.url).searchParams);
    const games = await dependencies.search(query);
    const payload = gameSearchResponseSchema.parse({ data: games });
    return json(payload, 200, successHeaders);
  } catch (error) {
    if (error instanceof InvalidGameSearchQueryError) {
      return errorResponse(400, 'INVALID_QUERY', 'Parâmetros inválidos.');
    }
    if (error instanceof InvalidUpstreamResponseError) {
      return errorResponse(502, 'INVALID_UPSTREAM_RESPONSE', 'Resposta externa inválida.');
    }
    if (error instanceof UpstreamTimeoutError) {
      return errorResponse(504, 'UPSTREAM_TIMEOUT', 'Serviço externo excedeu o tempo limite.');
    }
    if (error instanceof ServiceUnavailableError) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível.');
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Erro interno.');
  }
}

const systemClock = { now: () => new Date() };
let productionRepository: IgdbGameSearchRepository | undefined;

function getProductionRepository() {
  if (productionRepository) return productionRepository;

  const environment = readIgdbEnvironment(process.env);
  const tokenProvider = new TwitchTokenProvider({
    clientId: environment.clientId,
    clientSecret: environment.clientSecret,
    clock: systemClock,
    fetcher: fetch,
  });
  productionRepository = new IgdbGameSearchRepository({
    clientId: environment.clientId,
    fetcher: fetch,
    tokenProvider,
  });
  return productionRepository;
}

const productionDependencies: GameSearchHandlerDependencies = {
  search: (query) => searchGames(query, getProductionRepository()),
};

export default {
  fetch(request: Request) {
    return handleGameSearchRequest(request, productionDependencies);
  },
};
