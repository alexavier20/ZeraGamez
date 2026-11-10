import { z } from 'zod';

import {
  gameSearchResultSchema,
  type GameSearchResult,
} from '../../../shared/contracts/game-search.js';
import {
  InvalidUpstreamResponseError,
  isTimeoutError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from '../../releases/infrastructure/upstream-errors.js';

import type { SteamRankingMetric } from '../../../shared/contracts/steam-rankings.js';
import type {
  AccessTokenLease,
  AccessTokenProvider,
} from '../../releases/infrastructure/twitch-token-provider.js';
import type { GameSearchRepository } from '../application/search-games.js';

const igdbDateSchema = z
  .number()
  .int()
  .transform((seconds, context) => {
    const milliseconds = seconds * 1_000;
    if (!Number.isSafeInteger(milliseconds)) {
      context.addIssue({ code: 'custom', message: 'Invalid IGDB date.' });
      return z.NEVER;
    }
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: 'custom', message: 'Invalid IGDB date.' });
      return z.NEVER;
    }
    return date.toISOString().slice(0, 10);
  });

const igdbGameSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  first_release_date: igdbDateSchema.nullable().optional(),
  aggregated_rating: z.number().min(0).max(100).optional(),
  hypes: z.number().int().nonnegative().nullable().optional(),
  cover: z
    .object({ image_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/) })
    .nullable()
    .optional(),
  platforms: z.array(z.object({ name: z.string().trim().min(1) })).optional(),
});

const igdbGamesSchema = z.array(igdbGameSchema).max(30);
const GAME_SEARCH_LIMIT = 30;
// Use IGDB's type IDs: display names differ from API names, including a typo in reviews.
const steamPopularityTypeIds: Record<SteamRankingMetric, number> = {
  'peak-players': 5,
  'positive-reviews': 6,
  'top-sellers': 9,
};
interface IgdbGameSearchRepositoryOptions {
  clientId: string;
  fetcher: typeof fetch;
  tokenProvider: AccessTokenProvider;
  timeoutMs?: number;
}

interface IgdbRequestResult {
  readonly response: Response;
  readonly timeoutSignal: AbortSignal;
  readonly tokenLease: AccessTokenLease;
}

function imageUrl(imageId: string) {
  return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${encodeURIComponent(imageId)}.jpg`;
}

function escapeApicalypseString(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function toGameSearchResult(game: z.infer<typeof igdbGameSchema>): GameSearchResult {
  return gameSearchResultSchema.parse({
    id: game.id,
    name: game.name,
    coverUrl: game.cover ? imageUrl(game.cover.image_id) : null,
    releaseDate: game.first_release_date ?? null,
    ...(game.aggregated_rating !== undefined ? { criticScore: game.aggregated_rating } : {}),
    platforms: [...new Set((game.platforms ?? []).map(({ name }) => name))],
  });
}

export class IgdbGameSearchRepository implements GameSearchRepository {
  private readonly options: IgdbGameSearchRepositoryOptions;

  constructor(options: IgdbGameSearchRepositoryOptions) {
    this.options = options;
  }

  async search(query: string): Promise<readonly GameSearchResult[]> {
    const safeQuery = escapeApicalypseString(query);
    const body = [
      'search "' + safeQuery + '";',
      'fields id,name,first_release_date,cover.image_id,platforms.name;',
      'where version_parent = null;',
      `limit ${String(GAME_SEARCH_LIMIT)};`,
    ].join(' ');
    return this.fetchGames(body);
  }

  async listMostAnticipated(): Promise<readonly GameSearchResult[]> {
    return this.listUpcomingByHype(6);
  }

  async listRecentReviewed(): Promise<readonly GameSearchResult[]> {
    const now = Math.floor(Date.now() / 1000);
    return this.fetchGames(
      'fields id,name,first_release_date,aggregated_rating,cover.image_id,platforms.name; where first_release_date <= ' +
        String(now) +
        ' & aggregated_rating != null & version_parent = null; sort first_release_date desc; limit 20;',
    );
  }

  async listTopHyped(): Promise<readonly GameSearchResult[]> {
    return this.listUpcomingByHype(10);
  }

  async listSteamRanking(metric: SteamRankingMetric): Promise<readonly GameSearchResult[]> {
    const primitives = z
      .array(
        z.object({
          game_id: z.number().int().positive(),
          value: z.number().nonnegative(),
        }),
      )
      .max(30)
      .safeParse(
        await this.fetchJson(
          `fields game_id,value; where popularity_type = ${String(steamPopularityTypeIds[metric])}; sort value desc; limit 30;`,
          'popularity_primitives',
        ),
      );
    if (!primitives.success) throw new InvalidUpstreamResponseError('Ranking IGDB inválido.');
    const ids = [...new Set(primitives.data.map((entry) => entry.game_id))];
    if (ids.length === 0) return [];
    const games = await this.fetchGames(
      `fields id,name,first_release_date,cover.image_id,platforms.name; where id = (${ids.join(',')}); limit 30;`,
    );
    const byId = new Map(games.map((game) => [game.id, game]));
    return ids
      .flatMap((id) => {
        const game = byId.get(id);
        return game
          ? [
              {
                ...game,
                steamRankingValue: primitives.data.find((entry) => entry.game_id === id)?.value,
              },
            ]
          : [];
      })
      .slice(0, 5);
  }

  private async listUpcomingByHype(limit: number): Promise<readonly GameSearchResult[]> {
    const now = Math.floor(Date.now() / 1_000);
    const body = [
      'fields id,name,first_release_date,hypes,cover.image_id,platforms.name;',
      `where first_release_date > ${String(now)} & version_parent = null;`,
      'sort hypes desc;',
      `limit ${String(limit)};`,
    ].join(' ');
    const games = await this.fetchRawGames(body);
    return Object.freeze(
      games
        .filter((game) => (game.hypes ?? 0) > 0)
        .slice(0, limit)
        .map(toGameSearchResult),
    );
  }

  private async fetchGames(body: string): Promise<readonly GameSearchResult[]> {
    const games = await this.fetchRawGames(body);
    return Object.freeze(games.map(toGameSearchResult));
  }

  private async fetchRawGames(body: string): Promise<readonly z.infer<typeof igdbGameSchema>[]> {
    const payload = await this.fetchJson(body);
    const result = igdbGamesSchema.safeParse(payload);
    if (!result.success) throw new InvalidUpstreamResponseError('Resposta IGDB inválida.');

    return Object.freeze(result.data);
  }

  private async fetchJson(body: string, endpoint = 'games'): Promise<unknown> {
    let requestResult = await this.request(body, endpoint);
    if (requestResult.response.status === 401) {
      this.options.tokenProvider.invalidate(requestResult.tokenLease);
      requestResult = await this.request(body, endpoint);
    }

    const { response, timeoutSignal } = requestResult;
    if (!response.ok) throw new ServiceUnavailableError('IGDB indisponível.');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (isTimeoutError(error) || isTimeoutError(timeoutSignal.reason)) {
        throw new UpstreamTimeoutError('IGDB excedeu o tempo limite.');
      }
      if (error instanceof SyntaxError) {
        throw new InvalidUpstreamResponseError('Resposta IGDB inválida.');
      }
      throw new ServiceUnavailableError('IGDB indisponível.');
    }

    return payload;
  }

  private async request(body: string, endpoint: string): Promise<IgdbRequestResult> {
    const tokenLease = await this.options.tokenProvider.getToken();
    const timeoutSignal = AbortSignal.timeout(this.options.timeoutMs ?? 10_000);

    try {
      const response = await this.options.fetcher(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + tokenLease.token,
          'Client-ID': this.options.clientId,
        },
        body,
        signal: timeoutSignal,
      });
      return { response, timeoutSignal, tokenLease };
    } catch (error) {
      if (isTimeoutError(error) || isTimeoutError(timeoutSignal.reason)) {
        throw new UpstreamTimeoutError('IGDB excedeu o tempo limite.');
      }
      throw new ServiceUnavailableError('IGDB indisponível.');
    }
  }
}
