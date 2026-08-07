import { z } from 'zod';

const civilDateSchema = z.string().refine((value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}, 'Data civil inválida');

const httpsUrlSchema = z.url().startsWith('https://');

export const releasePlatformSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  abbreviation: z.string().trim().min(1).nullable(),
});

export const releaseGenreSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
});

export const releaseItemSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  coverUrl: httpsUrlSchema.nullable(),
  releaseDate: civilDateSchema,
  platforms: z.array(releasePlatformSchema).min(1),
  genres: z.array(releaseGenreSchema),
});

export const releasesResponseSchema = z.object({
  data: z.array(releaseItemSchema),
  meta: z.object({
    from: civilDateSchema,
    to: civilDateSchema,
    count: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100),
    generatedAt: z.iso.datetime({ offset: true }),
    sourceTruncated: z.boolean(),
  }),
});

export const apiErrorCodes = [
  'INVALID_QUERY',
  'METHOD_NOT_ALLOWED',
  'INVALID_UPSTREAM_RESPONSE',
  'SERVICE_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'INTERNAL_ERROR',
] as const;

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(apiErrorCodes),
    message: z.string().trim().min(1),
  }),
});

export type ReleasesResponse = z.infer<typeof releasesResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type ApiErrorCode = ApiErrorResponse['error']['code'];
