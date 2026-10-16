import {
  InvalidGameDetailsQueryError,
  parseGameDetailsId,
} from '../server/games/application/game-details-query';
import { getGameDetails } from '../server/games/application/get-game-details';
import { IgdbGameDetailsRepository } from '../server/games/infrastructure/igdb-game-details-repository';
import { readIgdbEnvironment } from '../server/releases/infrastructure/env';
import { TwitchTokenProvider } from '../server/releases/infrastructure/twitch-token-provider';
import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from '../server/releases/infrastructure/upstream-errors';
import { gameDetailsResponseSchema } from '../shared/contracts/game-details';
import { apiErrorResponseSchema, type ApiErrorCode } from '../shared/contracts/releases';

const successHeaders = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Content-Type': 'application/json; charset=utf-8',
  'Vercel-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
};

const errorHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export interface GameDetailsHandlerDependencies {
  load(id: number): ReturnType<typeof getGameDetails>;
}

function json(payload: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(status: number, code: ApiErrorCode, message: string) {
  const payload = apiErrorResponseSchema.parse({ error: { code, message } });
  return json(payload, status, errorHeaders);
}

export async function handleGameDetailsRequest(
  request: Request,
  dependencies: GameDetailsHandlerDependencies,
) {
  if (request.method !== 'GET') {
    const response = errorResponse(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    response.headers.set('Allow', 'GET');
    return response;
  }

  try {
    const id = parseGameDetailsId(new URL(request.url).searchParams);
    const game = await dependencies.load(id);
    if (game === null) return errorResponse(404, 'NOT_FOUND', 'Jogo não encontrado.');
    const payload = gameDetailsResponseSchema.parse({ data: game });
    return json(payload, 200, successHeaders);
  } catch (error) {
    if (error instanceof InvalidGameDetailsQueryError) {
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
let productionRepository: IgdbGameDetailsRepository | undefined;

function getProductionRepository() {
  if (productionRepository) return productionRepository;

  const environment = readIgdbEnvironment(process.env);
  const tokenProvider = new TwitchTokenProvider({
    clientId: environment.clientId,
    clientSecret: environment.clientSecret,
    clock: systemClock,
    fetcher: fetch,
  });
  productionRepository = new IgdbGameDetailsRepository({
    clientId: environment.clientId,
    fetcher: fetch,
    tokenProvider,
  });
  return productionRepository;
}

const productionDependencies: GameDetailsHandlerDependencies = {
  load: (id) => getGameDetails(id, getProductionRepository()),
};

export default {
  fetch(request: Request) {
    return handleGameDetailsRequest(request, productionDependencies);
  },
};
