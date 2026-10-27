import { z } from 'zod';

import { toDataError } from '@/shared/supabase/data-error';

import { civilDateSchema } from '../../../../shared/contracts/releases';
import { normalizeCreateListInput, type CreateListInput } from '@/features/lists/model/lists';
import {
  tierLabels,
  type TierLabel,
  type TierListDetails,
  type TierListGame,
  type TierListItem,
  type TierListSummary,
} from '../model/tier-lists';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TierListsRepository {
  addGame(tierListId: number, game: TierListGame, position: number): Promise<void>;
  createList(userId: string, input: CreateListInput): Promise<TierListSummary>;
  getList(userId: string, tierListId: number): Promise<TierListDetails | null>;
  listSummaries(userId: string): Promise<readonly TierListSummary[]>;
  moveGame(
    tierListId: number,
    igdbId: number,
    tier: TierLabel | null,
    position: number,
  ): Promise<void>;
}

const databaseIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const tierSchema = z.enum(tierLabels).nullable();
const coverUrlSchema = z
  .string()
  .regex(
    /^https:\/\/images[.]igdb[.]com\/igdb\/image\/upload\/t_cover_big_2x\/[A-Za-z0-9_-]+[.]jpg$/,
  )
  .nullable();

const tierListRowSchema = z.object({
  id: databaseIdSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).nullable(),
});
const tierListRowsSchema = z.array(tierListRowSchema);
const tierListItemRowSchema = z.object({
  igdb_id: databaseIdSchema,
  name: z.string().trim().min(1).max(200),
  cover_url: coverUrlSchema,
  release_date: civilDateSchema.nullable(),
  tier: tierSchema,
  position: z.number().int().nonnegative(),
});
const tierListItemRowsSchema = z.array(tierListItemRowSchema);

function parseData<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw toDataError(parsed.error);
  return parsed.data;
}

function toItem(row: z.infer<typeof tierListItemRowSchema>): TierListItem {
  return {
    coverUrl: row.cover_url,
    igdbId: row.igdb_id,
    name: row.name,
    position: row.position,
    releaseDate: row.release_date,
    tier: row.tier,
  };
}

export function createSupabaseTierListsRepository(client: SupabaseClient): TierListsRepository {
  return {
    async addGame(tierListId, game, position) {
      const { error } = await client.from('tier_list_items').insert({
        tier_list_id: tierListId,
        igdb_id: game.id,
        name: game.name,
        cover_url: game.coverUrl,
        release_date: game.releaseDate,
        tier: null,
        position,
      });

      if (error !== null) throw toDataError(error);
    },

    async createList(userId, input) {
      const normalized = normalizeCreateListInput(input);
      const { data, error } = await client
        .from('tier_lists')
        .insert({
          user_id: userId,
          name: normalized.name,
          description: normalized.description || null,
        })
        .select('id, name, description')
        .single();

      if (error !== null) throw toDataError(error);
      const row = parseData(tierListRowSchema, data);
      return { ...row, gameCount: 0 };
    },

    async getList(userId, tierListId) {
      const { data, error } = await client
        .from('tier_lists')
        .select('id, name, description')
        .eq('id', tierListId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error !== null) throw toDataError(error);
      if (data === null) return null;

      const list = parseData(tierListRowSchema, data);
      const { data: itemData, error: itemError } = await client
        .from('tier_list_items')
        .select('igdb_id, name, cover_url, release_date, tier, position')
        .eq('tier_list_id', tierListId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (itemError !== null) throw toDataError(itemError);
      const items = parseData(tierListItemRowsSchema, itemData).map(toItem);

      return { ...list, gameCount: items.length, items };
    },

    async listSummaries(userId) {
      const { data, error } = await client
        .from('tier_lists')
        .select('id, name, description')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error !== null) throw toDataError(error);
      const lists = parseData(tierListRowsSchema, data);
      if (lists.length === 0) return [];

      const { data: itemData, error: itemError } = await client
        .from('tier_list_items')
        .select('tier_list_id')
        .in(
          'tier_list_id',
          lists.map((list) => list.id),
        );

      if (itemError !== null) throw toDataError(itemError);
      const counts = new Map<number, number>();
      for (const item of z.array(z.object({ tier_list_id: databaseIdSchema })).parse(itemData)) {
        counts.set(item.tier_list_id, (counts.get(item.tier_list_id) ?? 0) + 1);
      }

      return lists.map((list) => ({
        ...list,
        gameCount: counts.get(list.id) ?? 0,
      }));
    },

    async moveGame(tierListId, igdbId, tier, position) {
      const { error } = await client
        .from('tier_list_items')
        .update({ tier, position })
        .eq('tier_list_id', tierListId)
        .eq('igdb_id', igdbId);

      if (error !== null) throw toDataError(error);
    },
  };
}
