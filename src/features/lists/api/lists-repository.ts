import { z } from 'zod';

import { DataError, toDataError } from '@/shared/supabase/data-error';

import {
  normalizeCreateListInput,
  type CreateListInput,
  type GameSnapshot,
  type UserListSummary,
} from '../model/lists';

interface TransportResponse {
  readonly data: unknown;
  readonly error: unknown | null;
}

interface CreatedListInsert {
  readonly description: string;
  readonly name: string;
  readonly system_key: null;
  readonly user_id: string;
}

interface SingleRowPort {
  single(): PromiseLike<TransportResponse>;
}

interface SelectRowPort {
  select(columns: string): SingleRowPort;
}

interface ListsTablePort {
  insert(values: CreatedListInsert): SelectRowPort;
}

interface SupabaseListsPort {
  from(table: 'lists'): ListsTablePort;
  rpc(
    name: string,
    args?: Readonly<Record<string, unknown>>,
  ): PromiseLike<TransportResponse>;
}

export interface ListsRepository {
  addGameToLists(game: GameSnapshot, listIds: readonly number[]): Promise<readonly number[]>;
  createList(userId: string, input: CreateListInput): Promise<UserListSummary>;
  getWantToPlayIds(igdbIds: readonly number[]): Promise<ReadonlySet<number>>;
  listSummaries(): Promise<readonly UserListSummary[]>;
  toggleWantToPlay(game: GameSnapshot): Promise<boolean>;
}

const databaseIdSchema = z
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger);

const listSummaryRowSchema = z.object({
  covers: z.array(z.string()),
  description: z.string().max(500).nullable(),
  game_count: z.number().int().nonnegative().refine(Number.isSafeInteger),
  id: databaseIdSchema,
  name: z.string().min(1).max(80),
  system_key: z.literal('want_to_play').nullable(),
});

const listSummaryRowsSchema = z.array(listSummaryRowSchema);

const createdListRowSchema = z.object({
  id: databaseIdSchema,
});

const databaseIdArraySchema = z.array(databaseIdSchema);
const wantToPlayRowsSchema = z.array(z.object({ igdb_id: databaseIdSchema }));
const toggleResultSchema = z.boolean();

export function createSupabaseListsRepository(client: SupabaseListsPort): ListsRepository {
  return {
    async addGameToLists(
      game: GameSnapshot,
      listIds: readonly number[],
    ): Promise<readonly number[]> {
      const normalizedListIds = deduplicateIds(listIds);
      if (normalizedListIds.length === 0) throw new DataError('unexpected');

      const associatedListIds = await readData(
        () =>
          client.rpc('add_game_to_lists', {
            p_igdb_id: game.igdbId,
            p_name: game.name,
            p_cover_url: game.coverUrl,
            p_release_date: game.releaseDate,
            p_list_ids: normalizedListIds,
          }),
        databaseIdArraySchema,
      );

      return Object.freeze([...associatedListIds]);
    },

    async createList(userId: string, input: CreateListInput): Promise<UserListSummary> {
      const normalizedInput = normalizeCreateListInput(input);
      const createdList = await readData(
        () =>
          client
            .from('lists')
            .insert({
              user_id: userId,
              name: normalizedInput.name,
              description: normalizedInput.description,
              system_key: null,
            })
            .select('id')
            .single(),
        createdListRowSchema,
      );
      const summaries = await loadListSummaries(client);
      const summary = summaries.find((candidate) => candidate.id === createdList.id);
      if (summary === undefined) throw new DataError('unexpected');

      return summary;
    },

    async getWantToPlayIds(igdbIds: readonly number[]): Promise<ReadonlySet<number>> {
      const normalizedIgdbIds = deduplicateIds(igdbIds);
      if (normalizedIgdbIds.length === 0) return new Set<number>();

      const rows = await readData(
        () =>
          client.rpc('get_want_to_play_igdb_ids', {
            p_igdb_ids: normalizedIgdbIds,
          }),
        wantToPlayRowsSchema,
      );

      return new Set(rows.map((row) => row.igdb_id));
    },

    async listSummaries(): Promise<readonly UserListSummary[]> {
      return loadListSummaries(client);
    },

    async toggleWantToPlay(game: GameSnapshot): Promise<boolean> {
      return readData(
        () =>
          client.rpc('toggle_want_to_play', {
            p_igdb_id: game.igdbId,
            p_name: game.name,
            p_cover_url: game.coverUrl,
            p_release_date: game.releaseDate,
          }),
        toggleResultSchema,
      );
    },
  };
}

function deduplicateIds(ids: readonly number[]): readonly number[] {
  return [...new Set(ids)];
}

function toUserListSummary(row: z.infer<typeof listSummaryRowSchema>): UserListSummary {
  return Object.freeze({
    covers: Object.freeze([...row.covers]),
    description: row.description,
    gameCount: row.game_count,
    id: row.id,
    name: row.name,
    systemKey: row.system_key,
  });
}

async function loadListSummaries(
  client: SupabaseListsPort,
): Promise<readonly UserListSummary[]> {
  const rows = await readData(() => client.rpc('get_my_lists'), listSummaryRowsSchema);

  return Object.freeze(rows.map(toUserListSummary));
}

async function readData<Output>(
  operation: () => PromiseLike<TransportResponse>,
  schema: z.ZodType<Output>,
): Promise<Output> {
  const response = await callTransport(operation);
  if (response.error !== null) throw toDataError(response.error);

  const parsed = schema.safeParse(response.data);
  if (!parsed.success) throw new DataError('unexpected', { cause: parsed.error });

  return parsed.data;
}

async function callTransport<Result>(operation: () => PromiseLike<Result>): Promise<Result> {
  try {
    return await operation();
  } catch (error) {
    throw toDataError(error);
  }
}
