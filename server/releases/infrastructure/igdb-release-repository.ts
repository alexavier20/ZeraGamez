import { z } from 'zod';

import { addDays, type ReleaseQuery } from '../application/releases-query';

import {
  InvalidUpstreamResponseError,
  isTimeoutError,
  ServiceUnavailableError,
  UpstreamTimeoutError,
} from './upstream-errors';

import type { AccessTokenLease, AccessTokenProvider } from './twitch-token-provider';
import type {
  ReleaseRepository,
  ReleaseRepositoryResult,
} from '../application/list-upcoming-releases';
import type { CandidateRelease } from '../domain/release';

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

    const isoTimestamp = date.toISOString();
    if (!/^\d{4}-\d{2}-\d{2}T/.test(isoTimestamp)) {
      context.addIssue({ code: 'custom', message: 'Invalid IGDB date.' });
      return z.NEVER;
    }
    return isoTimestamp.slice(0, 10);
  });

const releaseRegionSchema = z.union([
  z.object({ id: z.literal(8), region: z.literal('worldwide') }),
  z.object({ id: z.literal(10), region: z.literal('brazil') }),
]);

const igdbReleaseSchema = z.object({
  id: z.number().int().positive(),
  date: igdbDateSchema,
  release_region: releaseRegionSchema,
  game: z.object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    cover: z.object({ image_id: z.string().trim().min(1) }).optional(),
    genres: z
      .array(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1),
        }),
      )
      .optional(),
  }),
  platform: z.object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1),
    abbreviation: z.string().trim().min(1).optional(),
  }),
});

const igdbReleasesSchema = z.array(igdbReleaseSchema);
const fields = [
  'date',
  'release_region.id',
  'release_region.region',
  'game.id',
  'game.name',
  'game.slug',
  'game.cover.image_id',
  'game.genres.id',
  'game.genres.name',
  'platform.id',
  'platform.name',
  'platform.abbreviation',
].join(',');

function unixSeconds(date: string) {
  return Math.floor(Date.parse(date + 'T00:00:00.000Z') / 1_000);
}

function buildQuery(query: ReleaseQuery) {
  const filters = [
    'date >= ' + String(unixSeconds(query.from)),
    'date < ' + String(unixSeconds(addDays(query.to, 1))),
    'date_format = 0',
    'release_region = (8,10)',
  ];
  if (query.platformIds.length > 0) {
    filters.push('platform = (' + query.platformIds.join(',') + ')');
  }
  if (query.genreIds.length > 0) {
    filters.push('game.genres = (' + query.genreIds.join(',') + ')');
  }
  return [
    'fields ' + fields + ';',
    'where ' + filters.join(' & ') + ';',
    'sort date asc;',
    'limit 500;',
  ].join('\n');
}

interface IgdbReleaseRepositoryOptions {
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

export class IgdbReleaseRepository implements ReleaseRepository {
  private readonly options: IgdbReleaseRepositoryOptions;

  constructor(options: IgdbReleaseRepositoryOptions) {
    this.options = options;
  }

  async findUpcoming(query: ReleaseQuery): Promise<ReleaseRepositoryResult> {
    let requestResult = await this.request(query);
    if (requestResult.response.status === 401) {
      this.options.tokenProvider.invalidate(requestResult.tokenLease);
      requestResult = await this.request(query);
    }

    const { response, timeoutSignal } = requestResult;
    if (!response.ok) throw new ServiceUnavailableError('IGDB indisponivel.');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (isTimeoutError(error) || isTimeoutError(timeoutSignal.reason)) {
        throw new UpstreamTimeoutError('IGDB excedeu o timeout.');
      }
      if (error instanceof SyntaxError) {
        throw new InvalidUpstreamResponseError('Resposta IGDB invalida.');
      }
      throw new ServiceUnavailableError('IGDB indisponivel.');
    }

    const result = igdbReleasesSchema.safeParse(payload);
    if (!result.success) throw new InvalidUpstreamResponseError('Resposta IGDB invalida.');

    return {
      candidates: result.data.map((entry): CandidateRelease => ({
        game: {
          id: entry.game.id,
          slug: entry.game.slug,
          name: entry.game.name,
          coverUrl: entry.game.cover
            ? 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/' +
              encodeURIComponent(entry.game.cover.image_id) +
              '.jpg'
            : null,
          genres: entry.game.genres ?? [],
        },
        platform: {
          id: entry.platform.id,
          name: entry.platform.name,
          abbreviation: entry.platform.abbreviation ?? null,
        },
        releaseDate: entry.date,
        region: entry.release_region.region,
      })),
      sourceTruncated: result.data.length === 500,
    };
  }

  private async request(query: ReleaseQuery): Promise<IgdbRequestResult> {
    const tokenLease = await this.options.tokenProvider.getToken();
    const timeoutSignal = AbortSignal.timeout(this.options.timeoutMs ?? 10_000);
    try {
      const response = await this.options.fetcher('https://api.igdb.com/v4/release_dates', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + tokenLease.token,
          'Client-ID': this.options.clientId,
        },
        body: buildQuery(query),
        signal: timeoutSignal,
      });
      return { response, timeoutSignal, tokenLease };
    } catch (error) {
      if (isTimeoutError(error) || isTimeoutError(timeoutSignal.reason)) {
        throw new UpstreamTimeoutError('IGDB excedeu o timeout.');
      }
      throw new ServiceUnavailableError('IGDB indisponivel.');
    }
  }
}
