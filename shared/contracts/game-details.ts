import { z } from 'zod';

import { civilDateSchema } from './releases';

const httpsUrlSchema = z.url().startsWith('https://');

export const gameDetailsSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  summary: z.string().trim().min(1).nullable(),
  storyline: z.string().trim().min(1).nullable(),
  firstReleaseDate: civilDateSchema.nullable(),
  coverUrl: httpsUrlSchema.nullable(),
  rating: z.number().min(0).max(100).nullable(),
  ratingCount: z.number().int().nonnegative().nullable(),
  criticRating: z.number().min(0).max(100).nullable(),
  criticRatingCount: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string().trim().min(1)),
  platforms: z.array(z.string().trim().min(1)),
  developers: z.array(z.string().trim().min(1)),
  publishers: z.array(z.string().trim().min(1)),
  gameModes: z.array(z.string().trim().min(1)),
  playerPerspectives: z.array(z.string().trim().min(1)),
  ageRatings: z.array(
    z.object({
      organization: z.string().trim().min(1),
      rating: z.string().trim().min(1),
    }),
  ),
  artworks: z.array(httpsUrlSchema),
  screenshots: z.array(httpsUrlSchema),
  videos: z.array(
    z.object({
      name: z.string().trim().min(1),
      videoId: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
    }),
  ),
});

export const gameDetailsResponseSchema = z.object({ data: gameDetailsSchema });

export type GameDetails = z.infer<typeof gameDetailsSchema>;
export type GameDetailsResponse = z.infer<typeof gameDetailsResponseSchema>;
