import { z } from 'zod';

import { civilDateSchema } from './releases.js';

const httpsUrlSchema = z.url().startsWith('https://');

export const gameSearchResultSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  coverUrl: httpsUrlSchema.nullable(),
  releaseDate: civilDateSchema.nullable(),
  platforms: z.array(z.string().trim().min(1)),
  criticScore: z.number().min(0).max(100).optional(),
  hypeCount: z.number().int().nonnegative().optional(),
  steamRankingValue: z.number().nonnegative().optional(),
});

export const gameSearchResponseSchema = z.object({
  data: z.array(gameSearchResultSchema).max(30),
});

export type GameSearchResult = z.infer<typeof gameSearchResultSchema>;
