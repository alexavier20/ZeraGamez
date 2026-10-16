import { z } from 'zod';

import { gameDetailsSchema, type GameDetails } from '../../../shared/contracts/game-details';
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
import type { GameDetailsRepository } from '../application/get-game-details';

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
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  summary: z.string().trim().nullable().optional(),
  storyline: z.string().trim().nullable().optional(),
  first_release_date: igdbDateSchema.nullable().optional(),
  cover: z
    .object({ image_id: z.string().trim().min(1) })
    .nullable()
    .optional(),
  rating: z.number().min(0).max(100).nullable().optional(),
  rating_count: z.number().int().nonnegative().nullable().optional(),
  aggregated_rating: z.number().min(0).max(100).nullable().optional(),
  aggregated_rating_count: z.number().int().nonnegative().nullable().optional(),
  genres: z.array(z.object({ name: z.string().trim().min(1) })).optional(),
  platforms: z.array(z.object({ name: z.string().trim().min(1) })).optional(),
  involved_companies: z
    .array(
      z.object({
        company: z
          .object({ name: z.string().trim().min(1) })
          .nullable()
          .optional(),
        developer: z.boolean().optional(),
        publisher: z.boolean().optional(),
      }),
    )
    .optional(),
  game_modes: z.array(z.object({ name: z.string().trim().min(1) })).optional(),
  player_perspectives: z.array(z.object({ name: z.string().trim().min(1) })).optional(),
  age_ratings: z
    .array(
      z.object({
        organization: z
          .object({ name: z.string().trim().min(1) })
          .nullable()
          .optional(),
        rating_category: z
          .object({ rating: z.string().trim().min(1) })
          .nullable()
          .optional(),
      }),
    )
    .optional(),
  artworks: z.array(z.object({ image_id: z.string().trim().min(1) })).optional(),
  screenshots: z.array(z.object({ image_id: z.string().trim().min(1) })).optional(),
  videos: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        video_id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
      }),
    )
    .optional(),
});

const igdbGamesSchema = z.array(igdbGameSchema);
const fields = [
  'id',
  'slug',
  'name',
  'summary',
  'storyline',
  'first_release_date',
  'cover.image_id',
  'rating',
  'rating_count',
  'aggregated_rating',
  'aggregated_rating_count',
  'genres.name',
  'platforms.name',
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher',
  'game_modes.name',
  'player_perspectives.name',
  'age_ratings.organization.name',
  'age_ratings.rating_category.rating',
  'artworks.image_id',
  'screenshots.image_id',
  'videos.name',
  'videos.video_id',
].join(',');

interface IgdbGameDetailsRepositoryOptions {
  clientId: string;
  fetcher: typeof fetch;
  tokenProvider: AccessTokenProvider;
  timeoutMs?: number;
}

interface IgdbRequestResult {
  response: Response;
  timeoutSignal: AbortSignal;
  tokenLease: AccessTokenLease;
}

function imageUrl(imageId: string, size: 'cover_big_2x' | '1080p' | 'screenshot_med') {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${encodeURIComponent(imageId)}.jpg`;
}

function unique(values: readonly (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => value !== undefined))];
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function mapAgeRatings(
  ageRatings: z.infer<typeof igdbGameSchema>['age_ratings'] = [],
): GameDetails['ageRatings'] {
  const ratings: GameDetails['ageRatings'] = [];
  for (const ageRating of ageRatings) {
    const organization = ageRating.organization?.name;
    const rating = ageRating.rating_category?.rating;
    if (organization === undefined || rating === undefined) continue;
    if (ratings.some((entry) => entry.organization === organization && entry.rating === rating)) {
      continue;
    }
    ratings.push({ organization, rating });
  }
  return ratings;
}

function toGameDetails(game: z.infer<typeof igdbGameSchema>): GameDetails {
  const companies = game.involved_companies ?? [];
  return gameDetailsSchema.parse({
    id: game.id,
    slug: game.slug,
    name: game.name,
    summary: normalizeText(game.summary),
    storyline: normalizeText(game.storyline),
    firstReleaseDate: game.first_release_date ?? null,
    coverUrl: game.cover ? imageUrl(game.cover.image_id, 'cover_big_2x') : null,
    rating: game.rating ?? null,
    ratingCount: game.rating_count ?? null,
    criticRating: game.aggregated_rating ?? null,
    criticRatingCount: game.aggregated_rating_count ?? null,
    genres: unique((game.genres ?? []).map(({ name }) => name)),
    platforms: unique((game.platforms ?? []).map(({ name }) => name)),
    developers: unique(
      companies.filter(({ developer }) => developer).map(({ company }) => company?.name),
    ),
    publishers: unique(
      companies.filter(({ publisher }) => publisher).map(({ company }) => company?.name),
    ),
    gameModes: unique((game.game_modes ?? []).map(({ name }) => name)),
    playerPerspectives: unique((game.player_perspectives ?? []).map(({ name }) => name)),
    ageRatings: mapAgeRatings(game.age_ratings),
    artworks: (game.artworks ?? []).map(({ image_id }) => imageUrl(image_id, '1080p')),
    screenshots: (game.screenshots ?? []).map(({ image_id }) =>
      imageUrl(image_id, 'screenshot_med'),
    ),
    videos: (game.videos ?? []).map(({ name, video_id }) => ({ name, videoId: video_id })),
  });
}

export class IgdbGameDetailsRepository implements GameDetailsRepository {
  private readonly options: IgdbGameDetailsRepositoryOptions;

  constructor(options: IgdbGameDetailsRepositoryOptions) {
    this.options = options;
  }

  async findById(id: number): Promise<GameDetails | null> {
    let requestResult = await this.request(id);
    if (requestResult.response.status === 401) {
      this.options.tokenProvider.invalidate(requestResult.tokenLease);
      requestResult = await this.request(id);
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

    const result = igdbGamesSchema.safeParse(payload);
    if (!result.success) throw new InvalidUpstreamResponseError('Resposta IGDB inválida.');

    const game = result.data.at(0);
    return game === undefined ? null : toGameDetails(game);
  }

  private async request(id: number): Promise<IgdbRequestResult> {
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
        body: `fields ${fields}; where id = ${String(id)}; limit 1;`,
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
