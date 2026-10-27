import { z } from 'zod';

import {
  gameSearchResultSchema,
  type GameSearchResult,
} from '../../../shared/contracts/game-search';
import {
  InvalidUpstreamResponseError,
  isTimeoutError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from '../../releases/infrastructure/upstream-errors';

import type {
  AccessTokenLease,
  AccessTokenProvider,
} from '../../releases/infrastructure/twitch-token-provider';
import type { GameSearchRepository } from '../application/search-games';

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
  hypes: z.number().int().nonnegative().nullable().optional(),
  cover: z
    .object({ image_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/) })
    .nullable()
    .optional(),
  platforms: z.array(z.object({ name: z.string().trim().min(1) })).optional(),
});

const igdbGamesSchema = z.array(igdbGameSchema).max(30);
const GAME_SEARCH_LIMIT = 30;
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

  async listTopHyped(): Promise<readonly GameSearchResult[]> {
    return this.listUpcomingByHype(10);
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

  private async fetchJson(body: string): Promise<unknown> {
    let requestResult = await this.request(body);
    if (requestResult.response.status === 401) {
      this.options.tokenProvider.invalidate(requestResult.tokenLease);
      requestResult = await this.request(body);
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

  private async request(body: string): Promise<IgdbRequestResult> {
    const tokenLease = await this.options.tokenProvider.getToken();
    const timeoutSignal = AbortSignal.timeout(this.options.timeoutMs ?? 10_000);

    try {
      const response = await this.options.fetcher('https://api.igdb.com/v4/games', {
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
