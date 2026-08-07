// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { IgdbReleaseRepository } from './igdb-release-repository';
import { TwitchTokenProvider } from './twitch-token-provider';
import {
  InvalidUpstreamResponseError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from './upstream-errors';

import type { ReleaseQuery } from '../application/releases-query';

const query: ReleaseQuery = {
  from: '2026-08-07',
  to: '2026-08-10',
  limit: 50,
  platformIds: [6, 167],
  genreIds: [12],
};

const fixture = {
  id: 100,
  date: Date.parse('2026-08-08T00:00:00Z') / 1_000,
  release_region: { id: 10, region: 'brazil' },
  game: {
    id: 1,
    name: 'Game',
    slug: 'game',
    cover: { image_id: 'cover-id' },
    genres: [{ id: 12, name: 'RPG' }],
  },
  platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
};

function tokenResponse(token: string) {
  return Response.json({ access_token: token, expires_in: 3_600, token_type: 'bearer' });
}

function setup(fetcher: typeof fetch, timeoutMs?: number) {
  const tokenProvider = {
    getToken: vi.fn().mockResolvedValue({ token: 'token', generation: 0 }),
    invalidate: vi.fn(),
  };
  return {
    repository: new IgdbReleaseRepository({
      clientId: 'client-id',
      fetcher,
      tokenProvider,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    }),
    tokenProvider,
  };
}

describe('IgdbReleaseRepository', () => {
  it('envia a consulta fixa com limite inclusivo e converte a resposta externa', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([fixture]));
    const { repository } = setup(fetcher);

    const result = await repository.findUpcoming(query);

    const [url, init] = fetcher.mock.calls[0];
    const requestSignal = init?.signal;
    expect(url).toBe('https://api.igdb.com/v4/release_dates');
    expect(init).toEqual({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer token',
        'Client-ID': 'client-id',
      },
      body: [
        'fields date,release_region.id,release_region.region,game.id,game.name,game.slug,game.cover.image_id,game.genres.id,game.genres.name,platform.id,platform.name,platform.abbreviation;',
        'where date >= 1786060800 & date < 1786406400 & date_format = 0 & release_region = (8,10) & platform = (6,167) & game.genres = (12);',
        'sort date asc;',
        'limit 500;',
      ].join('\n'),
      signal: requestSignal,
    });
    expect(requestSignal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({
      candidates: [
        {
          game: {
            id: 1,
            name: 'Game',
            slug: 'game',
            coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cover-id.jpg',
            genres: [{ id: 12, name: 'RPG' }],
          },
          platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
          releaseDate: '2026-08-08',
          region: 'brazil',
        },
      ],
      sourceTruncated: false,
    });
  });

  it('omite filtros numericos quando as listas validadas estao vazias', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));
    const { repository } = setup(fetcher);

    await repository.findUpcoming({ ...query, platformIds: [], genreIds: [] });

    const [, init] = fetcher.mock.calls[0];
    expect(init?.body).toBe(
      [
        'fields date,release_region.id,release_region.region,game.id,game.name,game.slug,game.cover.image_id,game.genres.id,game.genres.name,platform.id,platform.name,platform.abbreviation;',
        'where date >= 1786060800 & date < 1786406400 & date_format = 0 & release_region = (8,10);',
        'sort date asc;',
        'limit 500;',
      ].join('\n'),
    );
  });

  it('sinaliza o teto bruto de 500 registros', async () => {
    const payload = Array.from({ length: 500 }, (_, index) => ({ ...fixture, id: index + 1 }));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));

    await expect(setup(fetcher).repository.findUpcoming(query)).resolves.toMatchObject({
      sourceTruncated: true,
    });
  });

  it('converte timestamp Unix negativo seguro em data civil anterior a 1970', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json([{ ...fixture, date: -86_400 }]));

    const result = await setup(fetcher).repository.findUpcoming(query);

    expect(result.candidates[0]?.releaseDate).toBe('1969-12-31');
  });

  it('invalida o token e repete uma vez com um token novo apos 401', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json([fixture]));
    const { repository, tokenProvider } = setup(fetcher);
    tokenProvider.getToken
      .mockResolvedValueOnce({ token: 'old', generation: 0 })
      .mockResolvedValueOnce({ token: 'new', generation: 1 });

    await repository.findUpcoming(query);

    expect(tokenProvider.invalidate).toHaveBeenCalledOnce();
    expect(tokenProvider.getToken).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer old' });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer new' });
  });

  it('compartilha uma unica renovacao OAuth quando chamadas concorrentes recebem 401', async () => {
    let oauthRequests = 0;
    const fetcher = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === 'https://id.twitch.tv/oauth2/token') {
        oauthRequests += 1;
        return Promise.resolve(tokenResponse(oauthRequests === 1 ? 'initial' : 'renewed'));
      }

      const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (authorization === 'Bearer initial') {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(Response.json([fixture]));
    });
    const tokenProvider = new TwitchTokenProvider({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      clock: { now: () => new Date('2026-08-07T12:00:00.000Z') },
      fetcher,
    });
    const repository = new IgdbReleaseRepository({
      clientId: 'client-id',
      fetcher,
      tokenProvider,
    });

    const results = await Promise.all([
      repository.findUpcoming(query),
      repository.findUpcoming(query),
    ]);

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.candidates.length === 1)).toBe(true);
    expect(oauthRequests).toBe(2);
  });

  it.each([
    { status: 401, attempts: 2 },
    { status: 429, attempts: 1 },
    { status: 500, attempts: 1 },
  ])('normaliza status externo $status sem repeticao adicional', async ({ status, attempts }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));

    await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    expect(fetcher).toHaveBeenCalledTimes(attempts);
  });

  it.each([
    {
      name: 'JSON sintaticamente invalido',
      response: () => new Response('{', { status: 200 }),
    },
    {
      name: 'schema inesperado',
      response: () => Response.json([{ ...fixture, game: { ...fixture.game, id: 0 } }]),
    },
    {
      name: 'regiao com id e nome sem correlacao',
      response: () => Response.json([{ ...fixture, release_region: { id: 8, region: 'brazil' } }]),
    },
    {
      name: 'data fora do intervalo ISO seguro',
      response: () => Response.json([{ ...fixture, date: 8_640_000_000_001 }]),
    },
  ])('rejeita $name', async ({ response }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());

    await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
      InvalidUpstreamResponseError,
    );
  });

  it('normaliza timeout de transporte', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('upstream detail', 'TimeoutError'));

    await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
      UpstreamTimeoutError,
    );
  });

  it('normaliza timeout durante a leitura do corpo', async () => {
    const response = Response.json([fixture]);
    vi.spyOn(response, 'json').mockRejectedValue(new DOMException('body detail', 'TimeoutError'));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
      UpstreamTimeoutError,
    );
  });

  it('normaliza leitura abortada pelo sinal de timeout', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('timeout', 'TimeoutError'));
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const response = Response.json([fixture]);
    vi.spyOn(response, 'json').mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    try {
      await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
        UpstreamTimeoutError,
      );
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it('normaliza falha de transporte durante a leitura do corpo', async () => {
    const response = Response.json([fixture]);
    vi.spyOn(response, 'json').mockRejectedValue(new TypeError('stream detail'));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(setup(fetcher).repository.findUpcoming(query)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it.each([
    { name: 'padrao', timeoutMs: undefined, expectedTimeout: 10_000 },
    { name: 'configurado', timeoutMs: 1_234, expectedTimeout: 1_234 },
  ])('encaminha o sinal de timeout $name ao fetch', async ({ timeoutMs, expectedTimeout }) => {
    const signal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([fixture]));

    try {
      await expect(setup(fetcher, timeoutMs).repository.findUpcoming(query)).resolves.toBeDefined();
      expect(timeoutSpy).toHaveBeenCalledWith(expectedTimeout);
      expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(signal);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it('nao expoe token nem detalhes externos nos erros normalizados', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Bearer token: upstream-private-body'));

    try {
      await setup(fetcher).repository.findUpcoming(query);
      throw new Error('Expected repository failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(String(error)).not.toContain('token');
      expect(String(error)).not.toContain('upstream-private-body');
    }
  });
});
