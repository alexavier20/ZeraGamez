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
  readonly error: unknown;
}

interface CreatedListInsert {
  readonly description: string | null;
  readonly name: string;
  readonly system_key: null;
  readonly user_id: string;
}

interface SingleRowPort {
  single(): PromiseLike<unknown>;
}

interface SelectRowPort {
  select(columns: string): SingleRowPort;
}

interface ListsTablePort {
  insert(values: CreatedListInsert): SelectRowPort;
}

interface SupabaseListsPort {
  from(table: 'lists'): ListsTablePort;
  rpc(name: string, args?: Readonly<Record<string, unknown>>): PromiseLike<unknown>;
}

export interface ListsRepository {
  addGameToLists(game: GameSnapshot, listIds: readonly number[]): Promise<readonly number[]>;
  createList(userId: string, input: CreateListInput): Promise<UserListSummary>;
  getWantToPlayIds(igdbIds: readonly number[]): Promise<ReadonlySet<number>>;
  listSummaries(): Promise<readonly UserListSummary[]>;
  setWantToPlay(game: GameSnapshot, desired: boolean): Promise<boolean>;
}

const MAX_ADD_LIST_IDS = 1_000;
const MEMBERSHIP_RPC_CHUNK_SIZE = 100;
const MAX_COVER_URL_LENGTH = 2_048;
const canonicalIgdbCoverPattern =
  /^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_cover_big_2x\/[A-Za-z0-9_-]+\.jpg$/;
const databaseIdSchema = z.number().int().positive().refine(Number.isSafeInteger);

const userIdSchema = z.uuid();

const isoCivilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealIsoCivilDate);

const gameSnapshotInputSchema = z.object({
  coverUrl: z
    .string()
    .trim()
    .max(MAX_COVER_URL_LENGTH)
    .refine((value) => canonicalIgdbCoverPattern.test(value))
    .nullable(),
  igdbId: databaseIdSchema,
  name: z.string().trim().min(1).max(200),
  releaseDate: isoCivilDateSchema,
});

const addListIdsInputSchema = z.array(databaseIdSchema).min(1);
const igdbIdsInputSchema = z.array(databaseIdSchema);
const desiredStateInputSchema = z.boolean();

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
  description: z.string().max(500).nullable(),
  id: databaseIdSchema,
  name: z.string().min(1).max(80),
  system_key: z.null(),
});

const databaseIdArraySchema = z.array(databaseIdSchema);
const wantToPlayRowsSchema = z.array(z.object({ igdb_id: databaseIdSchema }));
const toggleResultSchema = z.boolean();

const transportEnvelopeSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) =>
      Object.hasOwn(value, 'data') && Object.hasOwn(value, 'error') && value.error !== undefined,
  )
  .transform((value): TransportResponse => ({
    data: value.data,
    error: value.error,
  }));

export function createSupabaseListsRepository(client: SupabaseListsPort): ListsRepository {
  return {
    async addGameToLists(
      game: GameSnapshot,
      listIds: readonly number[],
    ): Promise<readonly number[]> {
      const normalizedGame = parseInput(gameSnapshotInputSchema, game);
      const validatedListIds = parseInput(addListIdsInputSchema, listIds);
      if (validatedListIds.length > MAX_ADD_LIST_IDS) throw new DataError('unexpected');
      const normalizedListIds = deduplicateIds(validatedListIds);

      const associatedListIds = await readData(
        () =>
          client.rpc('add_game_to_lists', {
            p_igdb_id: normalizedGame.igdbId,
            p_name: normalizedGame.name,
            p_cover_url: normalizedGame.coverUrl,
            p_release_date: normalizedGame.releaseDate,
            p_list_ids: normalizedListIds,
          }),
        databaseIdArraySchema,
      );

      return Object.freeze([...associatedListIds]);
    },

    async createList(userId: string, input: CreateListInput): Promise<UserListSummary> {
      const normalizedUserId = parseInput(userIdSchema, userId);
      const normalizedInput = normalizeListInput(input);
      const createdList = await readData(
        () =>
          client
            .from('lists')
            .insert({
              user_id: normalizedUserId,
              name: normalizedInput.name,
              description: normalizedInput.description || null,
              system_key: null,
            })
            .select('id,name,description,system_key')
            .single(),
        createdListRowSchema,
      );

      return toUserListSummary({
        ...createdList,
        covers: [],
        game_count: 0,
      });
    },

    async getWantToPlayIds(igdbIds: readonly number[]): Promise<ReadonlySet<number>> {
      const normalizedIgdbIds = deduplicateIds(parseInput(igdbIdsInputSchema, igdbIds));
      if (normalizedIgdbIds.length === 0) return new RuntimeReadonlySet<number>();

      const loadedIds = new Set<number>();
      for (const chunk of chunkIds(normalizedIgdbIds, MEMBERSHIP_RPC_CHUNK_SIZE)) {
        const rows = await readData(
          () =>
            client.rpc('get_want_to_play_igdb_ids', {
              p_igdb_ids: chunk,
            }),
          wantToPlayRowsSchema,
        );
        const requestedIds = new Set(chunk);
        for (const row of rows) {
          if (requestedIds.has(row.igdb_id)) loadedIds.add(row.igdb_id);
        }
      }

      return new RuntimeReadonlySet(loadedIds);
    },

    async listSummaries(): Promise<readonly UserListSummary[]> {
      return loadListSummaries(client);
    },

    async setWantToPlay(game: GameSnapshot, desired: boolean): Promise<boolean> {
      const normalizedGame = parseInput(gameSnapshotInputSchema, game);
      const normalizedDesired = parseInput(desiredStateInputSchema, desired);

      return readData(
        () =>
          client.rpc('set_want_to_play', {
            p_igdb_id: normalizedGame.igdbId,
            p_name: normalizedGame.name,
            p_cover_url: normalizedGame.coverUrl,
            p_release_date: normalizedGame.releaseDate,
            p_desired: normalizedDesired,
          }),
        toggleResultSchema,
      );
    },
  };
}

class RuntimeReadonlySet<Value> implements ReadonlySet<Value> {
  readonly #values: Set<Value>;
  readonly [Symbol.toStringTag] = 'Set';

  constructor(values: Iterable<Value> = []) {
    this.#values = new Set(values);
  }

  get size(): number {
    return this.#values.size;
  }

  [Symbol.iterator](): SetIterator<Value> {
    return this.#values[Symbol.iterator]();
  }

  entries(): SetIterator<[Value, Value]> {
    return this.#values.entries();
  }

  forEach(
    callback: (value: Value, secondValue: Value, set: ReadonlySet<Value>) => void,
    thisArg?: unknown,
  ): void {
    for (const value of this.#values) callback.call(thisArg, value, value, this);
  }

  has(value: Value): boolean {
    return this.#values.has(value);
  }

  keys(): SetIterator<Value> {
    return this.#values.keys();
  }

  values(): SetIterator<Value> {
    return this.#values.values();
  }
}

function deduplicateIds(ids: readonly number[]): readonly number[] {
  return [...new Set(ids)];
}

function chunkIds(ids: readonly number[], size: number): readonly (readonly number[])[] {
  const chunks: number[][] = [];
  for (let start = 0; start < ids.length; start += size) {
    chunks.push(ids.slice(start, start + size));
  }
  return chunks;
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

async function loadListSummaries(client: SupabaseListsPort): Promise<readonly UserListSummary[]> {
  const rows = await readData(() => client.rpc('get_my_lists'), listSummaryRowsSchema);

  return Object.freeze(rows.map(toUserListSummary));
}

async function readData<Output>(
  operation: () => PromiseLike<unknown>,
  schema: z.ZodType<Output>,
): Promise<Output> {
  const response = parseInput(transportEnvelopeSchema, await callTransport(operation));
  if (response.error !== null) throw toDataError(response.error);

  return parseInput(schema, response.data);
}

async function callTransport<Result>(operation: () => PromiseLike<Result>): Promise<Result> {
  try {
    return await operation();
  } catch (error) {
    throw toDataError(error);
  }
}

function normalizeListInput(input: CreateListInput): CreateListInput {
  try {
    return normalizeCreateListInput(input);
  } catch (error) {
    throw toDataError(error);
  }
}

function parseInput<Output>(schema: z.ZodType<Output>, input: unknown): Output {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DataError('unexpected', { cause: parsed.error });

  return parsed.data;
}

function isRealIsoCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
