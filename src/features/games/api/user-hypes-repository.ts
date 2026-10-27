import { z } from 'zod';

import { toDataError } from '@/shared/supabase/data-error';

import { civilDateSchema } from '../../../../shared/contracts/releases';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserHypeGame {
  readonly coverUrl: string | null;
  readonly igdbId: number;
  readonly name: string;
  readonly releaseDate: string | null;
}

export interface UserHypesRepository {
  list(userId: string): Promise<readonly UserHypeGame[]>;
  add(userId: string, game: GameSearchResult): Promise<void>;
  remove(userId: string, igdbId: number): Promise<void>;
}

const coverUrlSchema = z
  .string()
  .regex(
    /^https:\/\/images[.]igdb[.]com\/igdb\/image\/upload\/t_cover_big_2x\/[A-Za-z0-9_-]+[.]jpg$/,
  )
  .nullable();

const userHypeRecordSchema = z.object({
  igdb_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  name: z.string().trim().min(1).max(200),
  cover_url: coverUrlSchema,
  release_date: civilDateSchema.nullable(),
});

export function createSupabaseUserHypesRepository(client: SupabaseClient): UserHypesRepository {
  return {
    async list(userId) {
      const { data, error } = await client
        .from('user_hypes')
        .select('igdb_id, name, cover_url, release_date')
        .eq('user_id', userId)
        .order('release_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error !== null) throw toDataError(error);

      return z
        .array(userHypeRecordSchema)
        .parse(data)
        .map((record) => ({
          coverUrl: record.cover_url,
          igdbId: record.igdb_id,
          name: record.name,
          releaseDate: record.release_date,
        }));
    },

    async add(userId, game) {
      const { error } = await client.from('user_hypes').insert({
        user_id: userId,
        igdb_id: game.id,
        name: game.name,
        cover_url: game.coverUrl,
        release_date: game.releaseDate,
      });

      if (error !== null) throw toDataError(error);
    },

    async remove(userId, igdbId) {
      const { error } = await client
        .from('user_hypes')
        .delete()
        .eq('user_id', userId)
        .eq('igdb_id', igdbId);

      if (error !== null) throw toDataError(error);
    },
  };
}
