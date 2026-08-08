import {
  listUpcomingReleases,
  type Clock,
  type ListUpcomingReleasesDependencies,
  type ListUpcomingReleasesResult,
} from '../server/releases/application/list-upcoming-releases';
import {
  InvalidQueryError,
  parseReleasesQuery,
  type ReleaseQuery,
} from '../server/releases/application/releases-query';
import { readIgdbEnvironment } from '../server/releases/infrastructure/env';
import { IgdbReleaseRepository } from '../server/releases/infrastructure/igdb-release-repository';
import { TwitchTokenProvider } from '../server/releases/infrastructure/twitch-token-provider';
import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from '../server/releases/infrastructure/upstream-errors';
import {
  apiErrorResponseSchema,
  releasesResponseSchema,
  type ApiErrorCode,
} from '../shared/contracts/releases';

const successHeaders = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Content-Type': 'application/json; charset=utf-8',
  'Vercel-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
};

const errorHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export interface ReleaseHandlerDependencies {
  clock: Clock;
  load(query: ReleaseQuery): Promise<ListUpcomingReleasesResult>;
}

function json(payload: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(status: number, code: ApiErrorCode, message: string) {
  const payload = apiErrorResponseSchema.parse({ error: { code, message } });
  return json(payload, status, errorHeaders);
}

export async function handleReleasesRequest(
  request: Request,
  dependencies: ReleaseHandlerDependencies,
) {
  if (request.method !== 'GET') {
    const response = errorResponse(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    response.headers.set('Allow', 'GET');
    return response;
  }

  try {
    const query = parseReleasesQuery(new URL(request.url).searchParams, dependencies.clock);
    const payload = releasesResponseSchema.parse(await dependencies.load(query));
    return json(payload, 200, successHeaders);
  } catch (error) {
    if (error instanceof InvalidQueryError) {
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

const systemClock: Clock = {
  now: () => new Date(),
};

let productionDependencies: ListUpcomingReleasesDependencies | undefined;

function getProductionDependencies() {
  if (productionDependencies) return productionDependencies;

  const environment = readIgdbEnvironment(process.env);
  const tokenProvider = new TwitchTokenProvider({
    clientId: environment.clientId,
    clientSecret: environment.clientSecret,
    clock: systemClock,
    fetcher: fetch,
  });
  productionDependencies = {
    clock: systemClock,
    repository: new IgdbReleaseRepository({
      clientId: environment.clientId,
      fetcher: fetch,
      tokenProvider,
    }),
  };
  return productionDependencies;
}

const productionHandlerDependencies: ReleaseHandlerDependencies = {
  clock: systemClock,
  load: (query) => listUpcomingReleases(query, getProductionDependencies()),
};

export default {
  fetch(request: Request) {
    return handleReleasesRequest(request, productionHandlerDependencies);
  },
};
