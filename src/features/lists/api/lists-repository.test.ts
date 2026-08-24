import { describe, expect, it, vi } from 'vitest';

import { DataError } from '@/shared/supabase/data-error';

import type { GameSnapshot } from '../model/lists';
import { createSupabaseListsRepository } from './lists-repository';

interface TransportResponse {
  readonly data: unknown;
  readonly error: unknown | null;
}

interface ListInsertValues {
  readonly description: string;
  readonly name: string;
  readonly system_key: null;
  readonly user_id: string;
}

const game: GameSnapshot = {
  coverUrl: '/covers/chrono-veil.png',
  igdbId: 42,
  name: 'Chrono Veil',
  releaseDate: '2027-03-14',
};

const createdListRow = {
  id: 9,
};

function createListsPort(
  rpcData: Readonly<Record<string, unknown>> = {},
  createdData: unknown = createdListRow,
) {
  const single = vi.fn(async (): Promise<TransportResponse> => ({
    data: createdData,
    error: null,
  }));
  const select = vi.fn((_columns: string) => ({ single }));
  const insert = vi.fn((_values: ListInsertValues) => ({ select }));
  const from = vi.fn((_table: string) => ({ insert }));
  const rpc = vi.fn(
    async (
      name: string,
      _args?: Readonly<Record<string, unknown>>,
    ): Promise<TransportResponse> => ({
      data: rpcData[name] ?? null,
      error: null,
    }),
  );

  return { from, insert, rpc, select, single };
}

describe('createSupabaseListsRepository', () => {
  it('maps list summaries from the RPC contract to immutable values', async () => {
    const port = createListsPort({
      get_my_lists: [
        {
          id: 9,
          name: 'RPGs',
          description: null,
          system_key: null,
          game_count: 2,
          covers: ['/a.png'],
        },
      ],
    });
    const repository = createSupabaseListsRepository(port);

    const summaries = await repository.listSummaries();

    expect(summaries).toEqual([
      {
        id: 9,
        name: 'RPGs',
        description: null,
        systemKey: null,
        gameCount: 2,
        covers: ['/a.png'],
      },
    ]);
    expect(Object.isFrozen(summaries)).toBe(true);
    expect(Object.isFrozen(summaries[0])).toBe(true);
    expect(Object.isFrozen(summaries[0]?.covers)).toBe(true);
  });

  it('passes the exact game snapshot and selected list ids to the atomic RPC', async () => {
    const port = createListsPort({ add_game_to_lists: [9, 12] });
    const repository = createSupabaseListsRepository(port);

    await expect(repository.addGameToLists(game, [9, 12])).resolves.toEqual([9, 12]);
    expect(port.rpc).toHaveBeenCalledWith('add_game_to_lists', {
      p_igdb_id: game.igdbId,
      p_name: game.name,
      p_cover_url: game.coverUrl,
      p_release_date: game.releaseDate,
      p_list_ids: [9, 12],
    });
  });

  it('deduplicates selected list ids once while preserving their first-seen order', async () => {
    const port = createListsPort({ add_game_to_lists: [12, 9] });
    const repository = createSupabaseListsRepository(port);

    await repository.addGameToLists(game, [12, 9, 12, 9]);

    expect(port.rpc).toHaveBeenCalledWith(
      'add_game_to_lists',
      expect.objectContaining({ p_list_ids: [12, 9] }),
    );
  });

  it('rejects an empty add selection before calling the transport', async () => {
    const port = createListsPort();
    const repository = createSupabaseListsRepository(port);

    await expect(repository.addGameToLists(game, [])).rejects.toBeInstanceOf(DataError);
    expect(port.rpc).not.toHaveBeenCalled();
  });

  it('normalizes a create-list insert and uses the authenticated user id', async () => {
    const port = createListsPort({
      get_my_lists: [
        {
          id: 9,
          name: 'RPGs',
          description: 'Para jogar em 2027',
          system_key: null,
          game_count: 1,
          covers: ['/db-cover.png'],
        },
      ],
    });
    const repository = createSupabaseListsRepository(port);

    await expect(
      repository.createList('user-1', {
        name: '  RPGs  ',
        description: '  Para jogar em 2027  ',
      }),
    ).resolves.toEqual({
      id: 9,
      name: 'RPGs',
      description: 'Para jogar em 2027',
      systemKey: null,
      gameCount: 1,
      covers: ['/db-cover.png'],
    });
    expect(port.from).toHaveBeenCalledWith('lists');
    expect(port.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'RPGs',
      description: 'Para jogar em 2027',
      system_key: null,
    });
    expect(port.select).toHaveBeenCalledWith('id');
    expect(port.single).toHaveBeenCalledTimes(1);
    expect(port.rpc).toHaveBeenCalledWith('get_my_lists');
  });

  it('rejects null create-list data instead of inventing a summary from the input', async () => {
    const port = createListsPort({}, null);
    const repository = createSupabaseListsRepository(port);

    await expect(
      repository.createList('user-1', { name: 'RPGs', description: '' }),
    ).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });

  it('gets want-to-play ids in one deduplicated batch', async () => {
    const port = createListsPort({
      get_want_to_play_igdb_ids: [{ igdb_id: 42 }, { igdb_id: 99 }],
    });
    const repository = createSupabaseListsRepository(port);

    const ids = await repository.getWantToPlayIds([42, 99, 42]);

    expect(ids).toEqual(new Set([42, 99]));
    expect(port.rpc).toHaveBeenCalledTimes(1);
    expect(port.rpc).toHaveBeenCalledWith('get_want_to_play_igdb_ids', {
      p_igdb_ids: [42, 99],
    });
  });

  it('returns an empty readonly set without transport work for an empty id batch', async () => {
    const port = createListsPort();
    const repository = createSupabaseListsRepository(port);

    await expect(repository.getWantToPlayIds([])).resolves.toEqual(new Set<number>());
    expect(port.rpc).not.toHaveBeenCalled();
  });

  it('passes the exact snapshot to toggle and validates the boolean result', async () => {
    const port = createListsPort({ toggle_want_to_play: true });
    const repository = createSupabaseListsRepository(port);

    await expect(repository.toggleWantToPlay(game)).resolves.toBe(true);
    expect(port.rpc).toHaveBeenCalledWith('toggle_want_to_play', {
      p_igdb_id: game.igdbId,
      p_name: game.name,
      p_cover_url: game.coverUrl,
      p_release_date: game.releaseDate,
    });
  });

  it('rejects malformed database payloads with a sanitized DataError', async () => {
    const port = createListsPort({
      get_my_lists: [
        {
          id: 9,
          name: 'RPGs',
          description: null,
          system_key: null,
          game_count: 'two',
          covers: ['/a.png'],
        },
      ],
    });
    const repository = createSupabaseListsRepository(port);

    await expect(repository.listSummaries()).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });

  it('rejects null data for a non-null SQL RPC result', async () => {
    const port = createListsPort({ toggle_want_to_play: null });
    const repository = createSupabaseListsRepository(port);

    await expect(repository.toggleWantToPlay(game)).rejects.toBeInstanceOf(DataError);
  });

  it('sanitizes SDK errors returned by the transport', async () => {
    const port = createListsPort();
    port.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error('Postgres exposed sensitive details.'),
    });
    const repository = createSupabaseListsRepository(port);

    await expect(repository.listSummaries()).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });

  it('sanitizes promises rejected by the transport', async () => {
    const port = createListsPort();
    port.rpc.mockRejectedValueOnce(new Error('Network provider leaked a raw message.'));
    const repository = createSupabaseListsRepository(port);

    await expect(repository.listSummaries()).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });
});
