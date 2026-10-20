import { z } from 'zod';

import { civilDateSchema } from './releases';

const httpsUrlSchema = z.url().startsWith('https://');

export const gameSearchResultSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  coverUrl: httpsUrlSchema.nullable(),
  releaseDate: civilDateSchema.nullable(),
  platforms: z.array(z.string().trim().min(1)),
});

export const gameSearchResponseSchema = z.object({
  data: z.array(gameSearchResultSchema).max(12),
});

export type GameSearchResult = z.infer<typeof gameSearchResultSchema>;
