// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from '../server/releases/infrastructure/upstream-errors';
import { apiErrorResponseSchema, type ReleasesResponse } from '../shared/contracts/releases';

import type { ReleaseHandlerDependencies } from './releases';

const response: ReleasesResponse = {
  data: [],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 0,
    limit: 50,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};

function setup(load = vi.fn().mockResolvedValue(response)): ReleaseHandlerDependencies {
  return {
    clock: { now: () => new Date('2026-08-07T12:00:00.000Z') },
    load,
  };
}

async function handleReleasesRequest(request: Request, dependencies: ReleaseHandlerDependencies) {
  const releasesModule = await import('./releases');
  return releasesModule.handleReleasesRequest(request, dependencies);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('handleReleasesRequest', () => {
  it('rejeita método antes de carregar dependências externas', async () => {
    const load = vi.fn().mockResolvedValue(response);
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases', { method: 'POST' }),
      setup(load),
    );

    expect(result.status).toBe(405);
    expect(result.headers.get('allow')).toBe('GET');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(load).not.toHaveBeenCalled();
  });

  it('rejeita query inválida antes de carregar dependências externas', async () => {
    const load = vi.fn().mockResolvedValue(response);
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases?limit=101'),
      setup(load),
    );
    const body: unknown = await result.json();

    expect(result.status).toBe(400);
    expect(apiErrorResponseSchema.parse(body).error.code).toBe('INVALID_QUERY');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(load).not.toHaveBeenCalled();
  });

  it('retorna DTO validado e cache somente na CDN', async () => {
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases'),
      setup(),
    );

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(response);
    expect(result.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(result.headers.get('vercel-cdn-cache-control')).toBe(
      'public, max-age=900, stale-while-revalidate=3600',
    );
    expect(result.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('normaliza DTO de sucesso inválido como erro interno', async () => {
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases'),
      setup(
        vi.fn().mockResolvedValue({
          ...response,
          meta: { ...response.meta, generatedAt: 'not-a-timestamp' },
        }),
      ),
    );
    const body = apiErrorResponseSchema.parse(await result.json());

    expect(result.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.get('vercel-cdn-cache-control')).toBeNull();
  });

  it.each([
    [new InvalidUpstreamResponseError('secret'), 502, 'INVALID_UPSTREAM_RESPONSE'],
    [new ServiceUnavailableError('secret'), 503, 'SERVICE_UNAVAILABLE'],
    [new UpstreamTimeoutError('secret'), 504, 'UPSTREAM_TIMEOUT'],
    [new Error('secret'), 500, 'INTERNAL_ERROR'],
  ] as const)('normaliza erro sem expor detalhes', async (error, status, code) => {
    const result = await handleReleasesRequest(
      new Request('https://zera.test/api/releases'),
      setup(vi.fn().mockRejectedValue(error)),
    );
    const body = apiErrorResponseSchema.parse(await result.json());

    expect(result.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
});

describe('default Vercel function', () => {
  it('rejeita método antes de ler ambiente ou acessar a rede', async () => {
    vi.resetModules();
    vi.stubEnv('IGDB_CLIENT_ID', '');
    vi.stubEnv('IGDB_CLIENT_SECRET', '');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { default: releasesFunction } = await import('./releases');

    const result = await releasesFunction.fetch(
      new Request('https://zera.test/api/releases', { method: 'POST' }),
    );
    const body = apiErrorResponseSchema.parse(await result.json());

    expect(result.status).toBe(405);
    expect(result.headers.get('allow')).toBe('GET');
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
