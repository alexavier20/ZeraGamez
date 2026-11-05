// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  InvalidGameSearchQueryError,
  parseGameSearchRequest,
} from '../application/game-search-query';

import { IgdbGameSearchRepository } from './igdb-game-search-repository';

function setup(fetcher: typeof fetch) {
  return new IgdbGameSearchRepository({
    clientId: 'client-id',
    fetcher,
    tokenProvider: {
      getToken: () => Promise.resolve({ token: 'token', generation: 0 }),
      invalidate: vi.fn(),
    },
  });
}

describe('Steam rankings', () => {
  it('preserva a ordem do ranking, elimina duplicados e limita a cinco jogos', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          [9, 3, 3, 8, 1, 6, 5].map((game_id, index) => ({ game_id, value: 0.5 - index * 0.01 })),
        ),
      )
      .mockResolvedValueOnce(
        Response.json([1, 3, 5, 6, 8, 9].map((id) => ({ id, name: `Game ${String(id)}` }))),
      );
    const games = await setup(fetcher).listSteamRanking('peak-players');
    expect(games.map((game) => game.id)).toEqual([9, 3, 8, 1, 6]);
    expect(games[0]?.steamRankingValue).toBe(0.5);
    expect(games[1]?.steamRankingValue).toBe(0.49);
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.igdb.com/v4/popularity_primitives');
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain('sort value desc');
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain('popularity_type = 5');
  });

  it('não consulta jogos quando o ranking está vazio', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([]));
    await expect(setup(fetcher).listSteamRanking('positive-reviews')).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['peak-players', 5],
    ['positive-reviews', 6],
    ['top-sellers', 9],
  ] as const)(
    'consulta o indicador %s pelo ID sem depender do nome externo',
    async (metric, id) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([]));
      await setup(fetcher).listSteamRanking(metric);
      expect(fetcher.mock.calls[0]?.[1]?.body).toBe(
        `fields game_id,value; where popularity_type = ${String(id)}; sort value desc; limit 30;`,
      );
    },
  );

  it('rejeita indicadores e parâmetros que não estão na lista permitida', () => {
    expect(
      parseGameSearchRequest(new URLSearchParams('mode=steam-ranking&metric=top-sellers')),
    ).toEqual({ type: 'steam-ranking', metric: 'top-sellers' });
    for (const query of [
      'mode=steam-ranking&metric=invalid',
      'mode=steam-ranking&metric=top-sellers&metric=peak-players',
      'mode=steam-ranking&metric=top-sellers&extra=1',
    ]) {
      expect(() => parseGameSearchRequest(new URLSearchParams(query))).toThrow(
        InvalidGameSearchQueryError,
      );
    }
  });
});
