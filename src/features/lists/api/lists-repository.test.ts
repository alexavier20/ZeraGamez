import { describe, expect, it, vi } from 'vitest';

import { DataError } from '@/shared/supabase/data-error';

import { createSupabaseListsRepository } from './lists-repository';

import type { GameSnapshot } from '../model/lists';

interface TransportResponse {
  readonly data: unknown;
  readonly error: unknown;
}

const game: GameSnapshot = {
  coverUrl: '/covers/chrono-veil.png',
  igdbId: 42,
  name: 'Chrono Veil',
  releaseDate: '2027-03-14',
};

const userId = '550e8400-e29b-41d4-a716-446655440000';

const createdListRow = {
  id: 9,
  name: 'RPGs',
  description: 'Para jogar em 2027',
  system_key: null,
};

const invalidIds = [
  ['negative', -1],
  ['fractional', 1.5],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['unsafe', Number.MAX_SAFE_INTEGER + 1],
] as const;

const sanitizedDataError = {
  name: 'DataError',
  code: 'unexpected',
  message: 'Algo deu errado. Tente novamente.',
};

function createListsPort(
  rpcData: Readonly<Record<string, unknown>> = {},
  createdData: unknown = createdListRow,
) {
  const single = vi.fn((): Promise<TransportResponse> =>
    Promise.resolve({
      data: createdData,
      error: null,
    }),
  );
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  const rpc = vi.fn((name: string): Promise<TransportResponse> =>
    Promise.resolve({
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

  it.each(invalidIds)('rejects a %s list id before transport', async (_label, invalidId) => {
    const port = createListsPort({ add_game_to_lists: [9] });
    const repository = createSupabaseListsRepository(port);

    await expect(repository.addGameToLists(game, [9, invalidId])).rejects.toMatchObject(
      sanitizedDataError,
    );
    expect(port.rpc).not.toHaveBeenCalled();
  });

  it.each(invalidIds)(
    'rejects a %s want-to-play IGDB id before transport',
    async (_label, invalidId) => {
      const port = createListsPort({ get_want_to_play_igdb_ids: [] });
      const repository = createSupabaseListsRepository(port);

      await expect(repository.getWantToPlayIds([42, invalidId])).rejects.toMatchObject(
        sanitizedDataError,
      );
      expect(port.rpc).not.toHaveBeenCalled();
    },
  );

  it.each(invalidIds)(
    'rejects a %s snapshot IGDB id before transport',
    async (_label, invalidId) => {
      const port = createListsPort({ toggle_want_to_play: true });
      const repository = createSupabaseListsRepository(port);

      await expect(
        repository.toggleWantToPlay({ ...game, igdbId: invalidId }),
      ).rejects.toMatchObject(sanitizedDataError);
      expect(port.rpc).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['blank name', { ...game, name: '   ' }],
    ['name over 200 characters', { ...game, name: 'x'.repeat(201) }],
    ['impossible civil date', { ...game, releaseDate: '2027-02-29' }],
    ['non-ISO civil date', { ...game, releaseDate: '2027-2-14' }],
    ['non-string cover URL', { ...game, coverUrl: 123 } as unknown as GameSnapshot],
  ])('rejects a snapshot with %s before transport', async (_label, invalidGame) => {
    const port = createListsPort({ toggle_want_to_play: true });
    const repository = createSupabaseListsRepository(port);

    await expect(repository.toggleWantToPlay(invalidGame)).rejects.toMatchObject(
      sanitizedDataError,
    );
    expect(port.rpc).not.toHaveBeenCalled();
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
    const port = createListsPort();
    const repository = createSupabaseListsRepository(port);

    await expect(
      repository.createList(userId, {
        name: '  RPGs  ',
        description: '  Para jogar em 2027  ',
      }),
    ).resolves.toEqual({
      id: 9,
      name: 'RPGs',
      description: 'Para jogar em 2027',
      systemKey: null,
      gameCount: 0,
      covers: [],
    });
    expect(port.from).toHaveBeenCalledWith('lists');
    expect(port.insert).toHaveBeenCalledWith({
      user_id: userId,
      name: 'RPGs',
      description: 'Para jogar em 2027',
      system_key: null,
    });
    expect(port.select).toHaveBeenCalledWith('id,name,description,system_key');
    expect(port.single).toHaveBeenCalledTimes(1);
    expect(port.rpc).not.toHaveBeenCalled();
  });

  it('stores an empty normalized description as null and returns the database value', async () => {
    const port = createListsPort({}, { ...createdListRow, description: null });
    const repository = createSupabaseListsRepository(port);

    await expect(
      repository.createList(userId, { name: 'RPGs', description: '   ' }),
    ).resolves.toMatchObject({ description: null });
    expect(port.insert).toHaveBeenCalledWith({
      user_id: userId,
      name: 'RPGs',
      description: null,
      system_key: null,
    });
  });

  it('rejects an invalid user id before starting an insert', async () => {
    const port = createListsPort();
    const repository = createSupabaseListsRepository(port);

    await expect(
      repository.createList('user-1', { name: 'RPGs', description: '' }),
    ).rejects.toMatchObject(sanitizedDataError);
    expect(port.from).not.toHaveBeenCalled();
  });

  it('rejects null create-list data instead of inventing a summary from the input', async () => {
    const port = createListsPort({}, null);
    const repository = createSupabaseListsRepository(port);

    await expect(
      repository.createList(userId, { name: 'RPGs', description: '' }),
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

    expect([...ids]).toEqual([42, 99]);
    expect(port.rpc).toHaveBeenCalledTimes(1);
    expect(port.rpc).toHaveBeenCalledWith('get_want_to_play_igdb_ids', {
      p_igdb_ids: [42, 99],
    });
  });

  it('returns an empty readonly set without transport work for an empty id batch', async () => {
    const port = createListsPort();
    const repository = createSupabaseListsRepository(port);

    await expect(repository.getWantToPlayIds([])).resolves.toHaveProperty('size', 0);
    expect(port.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', [], [], []],
    ['filled', [42, 99], [{ igdb_id: 42 }, { igdb_id: 99 }], [42, 99]],
  ])(
    'returns a runtime-immutable readonly set when %s',
    async (_label, requestedIds, rows, expectedIds) => {
      const port = createListsPort({ get_want_to_play_igdb_ids: rows });
      const repository = createSupabaseListsRepository(port);

      const ids = await repository.getWantToPlayIds(requestedIds);
      let forEachSet: ReadonlySet<number> | undefined;
      ids.forEach((_value, _secondValue, set) => {
        forEachSet = set;
      });

      expect([...ids]).toEqual(expectedIds);
      expect(ids.has(42)).toBe(expectedIds.includes(42));
      expect((ids as unknown as { add?: unknown }).add).toBeUndefined();
      expect((ids as unknown as { delete?: unknown }).delete).toBeUndefined();
      expect((ids as unknown as { clear?: unknown }).clear).toBeUndefined();
      expect(() => (ids as unknown as Set<number>).add(777)).toThrow(TypeError);
      expect([...ids]).toEqual(expectedIds);
      if (expectedIds.length > 0) expect(forEachSet).toBe(ids);
    },
  );

  it('passes the exact snapshot to toggle and validates the boolean result', async () => {
    const port = createListsPort({ toggle_want_to_play: true });
    const repository = createSupabaseListsRepository(port);

    await expect(repository.toggleWantToPlay({ ...game, name: '  Chrono Veil  ' })).resolves.toBe(
      true,
    );
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

  it('sanitizes promises rejected by the insert transport', async () => {
    const port = createListsPort();
    port.single.mockRejectedValueOnce(new Error('Insert transport leaked a raw message.'));
    const repository = createSupabaseListsRepository(port);

    await expect(
      repository.createList(userId, { name: 'RPGs', description: '' }),
    ).rejects.toMatchObject(sanitizedDataError);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['missing error', { data: [] }],
    ['missing data', { error: null }],
  ])('sanitizes a %s resolved transport envelope', async (_label, malformedEnvelope) => {
    const port = createListsPort();
    port.rpc.mockResolvedValueOnce(malformedEnvelope as unknown as TransportResponse);
    const repository = createSupabaseListsRepository(port);

    await expect(repository.listSummaries()).rejects.toMatchObject(sanitizedDataError);
  });
});
