import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/features/auth/context/AuthProvider';

import { ListsProvider, isListsOperationCancelled, useLists } from './ListsProvider';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import type { ListsRepository } from '@/features/lists/api/lists-repository';
import type { GameSnapshot, UserListSummary } from '@/features/lists/model/lists';
import type { ReactNode } from 'react';

const authenticatedUser: AuthenticatedUser = {
  avatarUrl: null,
  email: 'alex@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  initials: 'AX',
  name: 'Alex Xavier',
};

const otherAuthenticatedUser: AuthenticatedUser = {
  avatarUrl: null,
  email: 'bia@example.com',
  id: '22222222-2222-4222-8222-222222222222',
  initials: 'BS',
  name: 'Bia Souza',
};

const rpgList: UserListSummary = {
  covers: ['https://images.example/rpg.jpg'],
  description: 'Campanhas longas',
  gameCount: 2,
  id: 7,
  name: 'RPGs',
  systemKey: null,
};

const wantToPlayList: UserListSummary = {
  covers: [],
  description: null,
  gameCount: 1,
  id: 9,
  name: 'Quero jogar',
  systemKey: 'want_to_play',
};

const game: GameSnapshot = {
  coverUrl: 'https://images.example/game.jpg',
  igdbId: 7346,
  name: 'The Legend of Zelda',
  releaseDate: '2026-08-24',
};

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function createAuthService(initialUser: AuthenticatedUser | null) {
  let listener: (user: AuthenticatedUser | null) => void = () => undefined;
  const service = {
    getCurrentUser: vi.fn().mockResolvedValue(initialUser),
    onAuthStateChange: vi.fn((nextListener: (user: AuthenticatedUser | null) => void) => {
      listener = nextListener;
      return vi.fn();
    }),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  } satisfies AuthService;

  return {
    emit(user: AuthenticatedUser | null) {
      listener(user);
    },
    service,
  };
}

function createRepository(overrides: Partial<ListsRepository> = {}): ListsRepository {
  return {
    addGameToLists: vi.fn().mockResolvedValue([]),
    createList: vi.fn().mockResolvedValue(rpgList),
    getWantToPlayIds: vi.fn().mockResolvedValue(new Set<number>()),
    listSummaries: vi.fn().mockResolvedValue([]),
    setWantToPlay: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function renderListsProvider(repository: ListsRepository | null) {
  const auth = createAuthService(authenticatedUser);
  let updateRepository!: (nextRepository: ListsRepository | null) => void;
  const Wrapper = ({ children }: { readonly children: ReactNode }) => {
    const [currentRepository, setCurrentRepository] = useState(repository);
    updateRepository = setCurrentRepository;
    return (
      <AuthProvider service={auth.service}>
        <ListsProvider repository={currentRepository}>{children}</ListsProvider>
      </AuthProvider>
    );
  };
  const view = renderHook(() => ({ auth: useAuth(), lists: useLists() }), {
    wrapper: Wrapper,
  });

  return {
    auth,
    changeRepository(nextRepository: ListsRepository | null) {
      act(() => {
        updateRepository(nextRepository);
      });
    },
    ...view,
  };
}

async function waitForAuthenticated(view: ReturnType<typeof renderListsProvider>): Promise<void> {
  await waitFor(() => {
    expect(view.result.current.auth.state.status).toBe('authenticated');
  });
}

describe('ListsProvider', () => {
  it('deduplicates concurrent list loads and publishes one success state', async () => {
    const pending = deferred<readonly UserListSummary[]>();
    const listSummaries = vi.fn(() => pending.promise);
    const repository = createRepository({ listSummaries });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    act(() => {
      void view.result.current.lists.loadLists();
      void view.result.current.lists.loadLists();
    });

    expect(listSummaries).toHaveBeenCalledTimes(1);
    expect(view.result.current.lists.listsState).toEqual({ status: 'loading' });

    pending.resolve([rpgList]);
    await waitFor(() => {
      expect(view.result.current.lists.listsState).toEqual({
        status: 'success',
        lists: [rpgList],
      });
    });
  });

  it('clears personal caches and ignores old completions when the user changes', async () => {
    const pendingLists = deferred<readonly UserListSummary[]>();
    const pendingMembership = deferred<ReadonlySet<number>>();
    const repository = createRepository({
      getWantToPlayIds: vi.fn(() => pendingMembership.promise),
      listSummaries: vi.fn(() => pendingLists.promise),
    });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    act(() => {
      void view.result.current.lists.loadLists();
      void view.result.current.lists.loadWantToPlayIds([game.igdbId]);
    });
    act(() => {
      view.auth.emit(otherAuthenticatedUser);
    });

    expect(view.result.current.lists.listsState).toEqual({ status: 'idle' });
    expect(view.result.current.lists.wantToPlayIds.size).toBe(0);

    pendingLists.resolve([rpgList]);
    pendingMembership.resolve(new Set([game.igdbId]));
    await act(async () => {
      await Promise.all([pendingLists.promise, pendingMembership.promise]);
    });

    expect(view.result.current.lists.listsState).toEqual({ status: 'idle' });
    expect(view.result.current.lists.wantToPlayIds.size).toBe(0);
  });

  it('does not accept an old A response after the scope changes A to B to A', async () => {
    const oldA = deferred<readonly UserListSummary[]>();
    const listSummaries = vi
      .fn()
      .mockImplementationOnce(() => oldA.promise)
      .mockResolvedValueOnce([wantToPlayList]);
    const view = renderListsProvider(createRepository({ listSummaries }));
    await waitForAuthenticated(view);

    act(() => {
      void view.result.current.lists.loadLists();
    });
    act(() => {
      view.auth.emit(otherAuthenticatedUser);
    });
    act(() => {
      view.auth.emit(authenticatedUser);
    });
    await act(() => view.result.current.lists.loadLists());
    expect(view.result.current.lists.listsState).toEqual({
      status: 'success',
      lists: [wantToPlayList],
    });

    oldA.resolve([rpgList]);
    await act(async () => oldA.promise);

    expect(view.result.current.lists.listsState).toEqual({
      status: 'success',
      lists: [wantToPlayList],
    });
  });

  it('shows an empty idle scope immediately on repository change and ignores old work', async () => {
    const pending = deferred<readonly UserListSummary[]>();
    const firstRepository = createRepository({ listSummaries: vi.fn(() => pending.promise) });
    const secondRepository = createRepository({
      listSummaries: vi.fn().mockResolvedValue([wantToPlayList]),
    });
    const view = renderListsProvider(firstRepository);
    await waitForAuthenticated(view);
    act(() => void view.result.current.lists.loadLists());

    view.changeRepository(secondRepository);

    expect(view.result.current.lists.listsState).toEqual({ status: 'idle' });
    expect(view.result.current.lists.wantToPlayIds.size).toBe(0);
    await act(() => view.result.current.lists.loadLists());
    expect(view.result.current.lists.listsState).toEqual({
      status: 'success',
      lists: [wantToPlayList],
    });

    pending.resolve([rpgList]);
    await act(async () => pending.promise);
    expect(view.result.current.lists.listsState).toEqual({
      status: 'success',
      lists: [wantToPlayList],
    });
  });

  it('clears caches when authentication becomes anonymous', async () => {
    const repository = createRepository({
      getWantToPlayIds: vi.fn().mockResolvedValue(new Set([game.igdbId])),
      listSummaries: vi.fn().mockResolvedValue([rpgList]),
    });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);
    await act(async () => {
      await view.result.current.lists.loadLists();
      await view.result.current.lists.loadWantToPlayIds([game.igdbId]);
    });

    act(() => {
      view.auth.emit(null);
    });

    expect(view.result.current.lists.listsState).toEqual({ status: 'idle' });
    expect(view.result.current.lists.wantToPlayIds.size).toBe(0);
  });

  it('permits retry after an error and force refreshes a successful cache', async () => {
    const listSummaries = vi
      .fn()
      .mockRejectedValueOnce(new Error('database detail'))
      .mockResolvedValueOnce([rpgList])
      .mockResolvedValueOnce([wantToPlayList]);
    const repository = createRepository({ listSummaries });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    await act(() => view.result.current.lists.loadLists());
    expect(view.result.current.lists.listsState).toEqual({
      status: 'error',
      message: 'Não foi possível carregar suas listas. Tente novamente.',
    });

    await act(() => view.result.current.lists.loadLists());
    expect(view.result.current.lists.listsState).toEqual({ status: 'success', lists: [rpgList] });

    await act(() => view.result.current.lists.loadLists());
    expect(listSummaries).toHaveBeenCalledTimes(2);

    await act(() => view.result.current.lists.loadLists({ force: true }));
    expect(listSummaries).toHaveBeenCalledTimes(3);
    expect(view.result.current.lists.listsState).toEqual({
      status: 'success',
      lists: [wantToPlayList],
    });
  });

  it('publishes only the confirmed created list and refreshes summaries', async () => {
    const pendingCreate = deferred<UserListSummary>();
    const createList = vi.fn(() => pendingCreate.promise);
    const listSummaries = vi.fn().mockResolvedValue([rpgList]);
    const repository = createRepository({ createList, listSummaries });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    let creation!: Promise<UserListSummary>;
    act(() => {
      creation = view.result.current.lists.createList({ name: 'RPGs', description: '' });
    });

    expect(view.result.current.lists.listsState).toEqual({ status: 'idle' });
    expect(listSummaries).not.toHaveBeenCalled();

    pendingCreate.resolve(rpgList);
    await expect(creation).resolves.toEqual(rpgList);

    expect(createList).toHaveBeenCalledWith(authenticatedUser.id, {
      name: 'RPGs',
      description: '',
    });
    expect(listSummaries).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(view.result.current.lists.listsState).toEqual({
        status: 'success',
        lists: [rpgList],
      });
    });
  });

  it('loads memberships in one batch and replaces only queried memberships after success', async () => {
    const getWantToPlayIds = vi
      .fn()
      .mockResolvedValueOnce(new Set([game.igdbId, 10]))
      .mockResolvedValueOnce(new Set([11]));
    const repository = createRepository({ getWantToPlayIds });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    await act(() => view.result.current.lists.loadWantToPlayIds([game.igdbId, 10]));
    await act(() => view.result.current.lists.loadWantToPlayIds([10, 11]));

    expect(getWantToPlayIds).toHaveBeenNthCalledWith(1, [game.igdbId, 10]);
    expect(getWantToPlayIds).toHaveBeenNthCalledWith(2, [10, 11]);
    expect([...view.result.current.lists.wantToPlayIds]).toEqual([game.igdbId, 11]);
    expect(view.result.current.lists.wantToPlayMemberships.get(game.igdbId)).toBe('ready');
    expect(view.result.current.lists.wantToPlayMemberships.get(10)).toBe('ready');
    expect(view.result.current.lists.wantToPlayMemberships.get(11)).toBe('ready');
  });

  it('scopes membership loading and sanitized retry state to each requested id', async () => {
    const failedLoad = deferred<ReadonlySet<number>>();
    const getWantToPlayIds = vi
      .fn()
      .mockImplementationOnce(() => failedLoad.promise)
      .mockResolvedValueOnce(new Set([game.igdbId]));
    const view = renderListsProvider(createRepository({ getWantToPlayIds }));
    await waitForAuthenticated(view);

    let first!: Promise<void>;
    act(() => {
      first = view.result.current.lists.loadWantToPlayIds([game.igdbId]);
    });
    expect(view.result.current.lists.wantToPlayMemberships.get(game.igdbId)).toBe('loading');
    expect(view.result.current.lists.wantToPlayMemberships.get(10)).toBeUndefined();

    failedLoad.reject(new Error('raw membership detail'));
    await expect(first).rejects.toThrow('raw membership detail');
    await waitFor(() => {
      expect(view.result.current.lists.wantToPlayMemberships.get(game.igdbId)).toBe('error');
    });
    expect(view.result.current.lists.wantToPlayMemberships.get(10)).toBeUndefined();

    await act(() => view.result.current.lists.loadWantToPlayIds([game.igdbId]));
    expect(view.result.current.lists.wantToPlayMemberships.get(game.igdbId)).toBe('ready');
    expect(view.result.current.lists.wantToPlayIds.has(game.igdbId)).toBe(true);
  });

  it('keeps the newest membership load when two loads for the same ID finish out of order', async () => {
    const firstLoad = deferred<ReadonlySet<number>>();
    const secondLoad = deferred<ReadonlySet<number>>();
    const getWantToPlayIds = vi
      .fn()
      .mockImplementationOnce(() => firstLoad.promise)
      .mockImplementationOnce(() => secondLoad.promise);
    const view = renderListsProvider(createRepository({ getWantToPlayIds }));
    await waitForAuthenticated(view);

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = view.result.current.lists.loadWantToPlayIds([game.igdbId]);
      second = view.result.current.lists.loadWantToPlayIds([game.igdbId]);
    });
    secondLoad.resolve(new Set([game.igdbId]));
    await act(async () => second);
    firstLoad.resolve(new Set<number>());
    await act(async () => first);

    expect(view.result.current.lists.wantToPlayIds.has(game.igdbId)).toBe(true);
    expect(getWantToPlayIds).toHaveBeenCalledTimes(2);
  });

  it('does not optimistically change memberships and preserves them when toggling fails', async () => {
    const pendingToggle = deferred<boolean>();
    const setWantToPlay = vi
      .fn()
      .mockImplementationOnce(() => pendingToggle.promise)
      .mockRejectedValueOnce(new Error('rpc detail'));
    const repository = createRepository({
      getWantToPlayIds: vi.fn().mockResolvedValue(new Set([10])),
      setWantToPlay,
    });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);
    await act(() => view.result.current.lists.loadWantToPlayIds([10]));

    let toggle!: Promise<boolean>;
    act(() => {
      toggle = view.result.current.lists.setWantToPlay(game, true);
    });
    expect([...view.result.current.lists.wantToPlayIds]).toEqual([10]);

    pendingToggle.resolve(true);
    await expect(toggle).resolves.toBe(true);
    await waitFor(() => {
      expect([...view.result.current.lists.wantToPlayIds]).toEqual([10, game.igdbId]);
    });

    await expect(view.result.current.lists.setWantToPlay(game, false)).rejects.toThrow(
      'rpc detail',
    );
    expect([...view.result.current.lists.wantToPlayIds]).toEqual([10, game.igdbId]);
  });

  it('allows the newest overlapping load to reconcile membership after a toggle fails', async () => {
    const pendingLoad = deferred<ReadonlySet<number>>();
    const pendingToggle = deferred<boolean>();
    const getWantToPlayIds = vi.fn(() => pendingLoad.promise);
    const setWantToPlay = vi.fn(() => pendingToggle.promise);
    const view = renderListsProvider(createRepository({ getWantToPlayIds, setWantToPlay }));
    await waitForAuthenticated(view);

    let load!: Promise<void>;
    let toggle!: Promise<boolean>;
    act(() => {
      toggle = view.result.current.lists.setWantToPlay(game, true);
      load = view.result.current.lists.loadWantToPlayIds([game.igdbId]);
    });
    pendingToggle.reject(new Error('rpc detail'));
    await expect(toggle).rejects.toThrow('rpc detail');
    pendingLoad.resolve(new Set([game.igdbId]));
    await act(async () => load);

    expect(view.result.current.lists.wantToPlayIds.has(game.igdbId)).toBe(true);
    expect(getWantToPlayIds).toHaveBeenCalledOnce();
    expect(setWantToPlay).toHaveBeenCalledOnce();
  });

  it('ignores a membership load that started before a confirmed toggle', async () => {
    const pendingLoad = deferred<ReadonlySet<number>>();
    const pendingToggle = deferred<boolean>();
    const getWantToPlayIds = vi.fn(() => pendingLoad.promise);
    const setWantToPlay = vi.fn(() => pendingToggle.promise);
    const repository = createRepository({
      getWantToPlayIds,
      setWantToPlay,
    });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    let load!: Promise<void>;
    let toggle!: Promise<boolean>;
    act(() => {
      load = view.result.current.lists.loadWantToPlayIds([game.igdbId]);
      toggle = view.result.current.lists.setWantToPlay(game, true);
    });
    pendingToggle.resolve(true);
    await act(async () => expect(toggle).resolves.toBe(true));
    pendingLoad.resolve(new Set<number>());
    await act(async () => load);

    expect(view.result.current.lists.wantToPlayIds.has(game.igdbId)).toBe(true);
    expect(getWantToPlayIds).toHaveBeenCalledOnce();
    expect(setWantToPlay).toHaveBeenCalledOnce();
  });

  it('ignores a membership load that started during a confirmed toggle', async () => {
    const pendingLoad = deferred<ReadonlySet<number>>();
    const pendingToggle = deferred<boolean>();
    const getWantToPlayIds = vi.fn(() => pendingLoad.promise);
    const setWantToPlay = vi.fn(() => pendingToggle.promise);
    const repository = createRepository({
      getWantToPlayIds,
      setWantToPlay,
    });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    let load!: Promise<void>;
    let toggle!: Promise<boolean>;
    act(() => {
      toggle = view.result.current.lists.setWantToPlay(game, true);
      load = view.result.current.lists.loadWantToPlayIds([game.igdbId]);
    });
    pendingToggle.resolve(true);
    await act(async () => expect(toggle).resolves.toBe(true));
    pendingLoad.resolve(new Set<number>());
    await act(async () => load);

    expect(view.result.current.lists.wantToPlayIds.has(game.igdbId)).toBe(true);
    expect(getWantToPlayIds).toHaveBeenCalledOnce();
    expect(setWantToPlay).toHaveBeenCalledOnce();
  });

  it('serializes desired-state mutations for the same game in call order', async () => {
    const firstMutation = deferred<boolean>();
    const secondMutation = deferred<boolean>();
    const setWantToPlay = vi
      .fn()
      .mockImplementationOnce(() => firstMutation.promise)
      .mockImplementationOnce(() => secondMutation.promise);
    const view = renderListsProvider(createRepository({ setWantToPlay }));
    await waitForAuthenticated(view);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = view.result.current.lists.setWantToPlay(game, true);
      second = view.result.current.lists.setWantToPlay(game, false);
    });
    expect(setWantToPlay).toHaveBeenCalledOnce();
    expect(setWantToPlay).toHaveBeenNthCalledWith(1, game, true);

    firstMutation.resolve(true);
    await expect(first).resolves.toBe(true);
    await waitFor(() => {
      expect(setWantToPlay).toHaveBeenCalledTimes(2);
    });
    expect(setWantToPlay).toHaveBeenNthCalledWith(2, game, false);
    secondMutation.resolve(false);
    await act(async () => {
      await expect(second).resolves.toBe(false);
    });

    expect(view.result.current.lists.wantToPlayMemberships.get(game.igdbId)).toBe('ready');
    expect(view.result.current.lists.wantToPlayIds.has(game.igdbId)).toBe(false);
  });

  it('cancels a queued old-scope mutation before its repository transport starts', async () => {
    const firstMutation = deferred<boolean>();
    const oldSetWantToPlay = vi
      .fn()
      .mockImplementationOnce(() => firstMutation.promise)
      .mockResolvedValueOnce(false);
    const newSetWantToPlay = vi.fn().mockResolvedValue(true);
    const view = renderListsProvider(createRepository({ setWantToPlay: oldSetWantToPlay }));
    await waitForAuthenticated(view);

    const first = view.result.current.lists.setWantToPlay(game, true);
    const second = view.result.current.lists.setWantToPlay(game, false);
    const firstOutcome = first.catch((reason: unknown) => reason);
    const secondOutcome = second.catch((reason: unknown) => reason);
    expect(oldSetWantToPlay).toHaveBeenCalledOnce();

    view.changeRepository(createRepository({ setWantToPlay: newSetWantToPlay }));
    firstMutation.resolve(true);

    expect(isListsOperationCancelled(await firstOutcome)).toBe(true);
    expect(isListsOperationCancelled(await secondOutcome)).toBe(true);
    expect(oldSetWantToPlay).toHaveBeenCalledOnce();
    expect(newSetWantToPlay).not.toHaveBeenCalled();
  });

  it('continues the serialized queue after an earlier desired-state mutation fails', async () => {
    const firstMutation = deferred<boolean>();
    const setWantToPlay = vi
      .fn()
      .mockImplementationOnce(() => firstMutation.promise)
      .mockResolvedValueOnce(true);
    const view = renderListsProvider(createRepository({ setWantToPlay }));
    await waitForAuthenticated(view);

    const first = view.result.current.lists.setWantToPlay(game, false);
    const second = view.result.current.lists.setWantToPlay(game, true);
    firstMutation.reject(new Error('rpc detail'));

    await expect(first).rejects.toThrow('rpc detail');
    await expect(second).resolves.toBe(true);
    expect(setWantToPlay).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(view.result.current.lists.wantToPlayIds.has(game.igdbId)).toBe(true);
    });
  });

  it('waits for add confirmation before refreshing list summaries', async () => {
    const pendingAdd = deferred<readonly number[]>();
    const addGameToLists = vi.fn(() => pendingAdd.promise);
    const listSummaries = vi.fn().mockResolvedValue([rpgList]);
    const repository = createRepository({ addGameToLists, listSummaries });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    let addition!: Promise<void>;
    act(() => {
      addition = view.result.current.lists.addGameToLists(game, [rpgList.id]);
    });
    expect(listSummaries).not.toHaveBeenCalled();

    pendingAdd.resolve([rpgList.id]);
    await addition;

    expect(addGameToLists).toHaveBeenCalledWith(game, [rpgList.id]);
    expect(listSummaries).toHaveBeenCalledOnce();
  });

  it('resolves a confirmed mutation even when its summary refresh fails', async () => {
    const repository = createRepository({
      createList: vi.fn().mockResolvedValue(rpgList),
      listSummaries: vi.fn().mockRejectedValue(new Error('refresh detail')),
    });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    await expect(
      view.result.current.lists.createList({ name: 'RPGs', description: '' }),
    ).resolves.toEqual(rpgList);
    await waitFor(() => {
      expect(view.result.current.lists.listsState).toEqual({
        status: 'error',
        message: 'Não foi possível carregar suas listas. Tente novamente.',
      });
    });
  });

  it('cancels create when the user changes during the post-confirmation refresh', async () => {
    const pendingRefresh = deferred<readonly UserListSummary[]>();
    const listSummaries = vi.fn(() => pendingRefresh.promise);
    const repository = createRepository({
      createList: vi.fn().mockResolvedValue(rpgList),
      listSummaries,
    });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);

    const creation = view.result.current.lists.createList({ name: 'RPGs', description: '' });
    await waitFor(() => {
      expect(listSummaries).toHaveBeenCalledOnce();
    });
    act(() => {
      view.auth.emit(otherAuthenticatedUser);
    });
    pendingRefresh.resolve([rpgList]);
    const error = await creation.catch((reason: unknown) => reason);

    expect(isListsOperationCancelled(error)).toBe(true);
  });

  it('cancels add when the repository changes during the post-confirmation refresh', async () => {
    const pendingRefresh = deferred<readonly UserListSummary[]>();
    const listSummaries = vi.fn(() => pendingRefresh.promise);
    const firstRepository = createRepository({
      addGameToLists: vi.fn().mockResolvedValue([rpgList.id]),
      listSummaries,
    });
    const view = renderListsProvider(firstRepository);
    await waitForAuthenticated(view);

    const addition = view.result.current.lists.addGameToLists(game, [rpgList.id]);
    await waitFor(() => {
      expect(listSummaries).toHaveBeenCalledOnce();
    });
    view.changeRepository(createRepository());
    pendingRefresh.resolve([rpgList]);
    const error = await addition.catch((reason: unknown) => reason);

    expect(isListsOperationCancelled(error)).toBe(true);
  });

  it('cancels a rejected create when the provider unmounts before repository completion', async () => {
    const pendingCreate = deferred<UserListSummary>();
    const view = renderListsProvider(
      createRepository({ createList: vi.fn(() => pendingCreate.promise) }),
    );
    await waitForAuthenticated(view);

    const creation = view.result.current.lists.createList({ name: 'RPGs', description: '' });
    const outcome = creation.catch((reason: unknown) => reason);
    view.unmount();
    pendingCreate.reject(new Error('stale database detail'));

    expect(isListsOperationCancelled(await outcome)).toBe(true);
  });

  it('cancels a rejected add when the repository changes before completion', async () => {
    const pendingAdd = deferred<readonly number[]>();
    const view = renderListsProvider(
      createRepository({ addGameToLists: vi.fn(() => pendingAdd.promise) }),
    );
    await waitForAuthenticated(view);

    const addition = view.result.current.lists.addGameToLists(game, [rpgList.id]);
    const outcome = addition.catch((reason: unknown) => reason);
    view.changeRepository(createRepository());
    pendingAdd.reject(new Error('stale database detail'));

    expect(isListsOperationCancelled(await outcome)).toBe(true);
  });

  it('cancels a pending toggle when the provider unmounts', async () => {
    const pendingToggle = deferred<boolean>();
    const view = renderListsProvider(
      createRepository({ setWantToPlay: vi.fn(() => pendingToggle.promise) }),
    );
    await waitForAuthenticated(view);

    const toggle = view.result.current.lists.setWantToPlay(game, true);
    view.unmount();
    pendingToggle.resolve(true);
    const error = await toggle.catch((reason: unknown) => reason);

    expect(isListsOperationCancelled(error)).toBe(true);
  });

  it('keeps descendants renderable and rejects private operations when unconfigured', async () => {
    const view = renderListsProvider(null);
    await waitForAuthenticated(view);

    await act(() => view.result.current.lists.loadLists());
    expect(view.result.current.lists.listsState).toEqual({
      status: 'error',
      message: 'As listas ainda não estão configuradas.',
    });
    await expect(
      view.result.current.lists.createList({ name: 'RPGs', description: '' }),
    ).rejects.toThrow('As listas ainda não estão configuradas.');
    await expect(view.result.current.lists.addGameToLists(game, [7])).rejects.toThrow(
      'As listas ainda não estão configuradas.',
    );
    await expect(view.result.current.lists.loadWantToPlayIds([game.igdbId])).rejects.toThrow(
      'As listas ainda não estão configuradas.',
    );
    await expect(view.result.current.lists.setWantToPlay(game, true)).rejects.toThrow(
      'As listas ainda não estão configuradas.',
    );
  });

  it('keeps operation callback identities stable across state changes', async () => {
    const repository = createRepository({ listSummaries: vi.fn().mockResolvedValue([rpgList]) });
    const view = renderListsProvider(repository);
    await waitForAuthenticated(view);
    const initial = view.result.current.lists;

    await act(() => view.result.current.lists.loadLists());

    expect(view.result.current.lists.addGameToLists).toBe(initial.addGameToLists);
    expect(view.result.current.lists.createList).toBe(initial.createList);
    expect(view.result.current.lists.loadLists).toBe(initial.loadLists);
    expect(view.result.current.lists.loadWantToPlayIds).toBe(initial.loadWantToPlayIds);
    expect(view.result.current.lists.setWantToPlay).toBe(initial.setWantToPlay);
  });

  it('keeps operation callback identities stable across auth scope changes', async () => {
    const view = renderListsProvider(createRepository());
    await waitForAuthenticated(view);
    const initial = view.result.current.lists;

    act(() => {
      view.auth.emit(otherAuthenticatedUser);
    });

    expect(view.result.current.lists.addGameToLists).toBe(initial.addGameToLists);
    expect(view.result.current.lists.createList).toBe(initial.createList);
    expect(view.result.current.lists.loadLists).toBe(initial.loadLists);
    expect(view.result.current.lists.loadWantToPlayIds).toBe(initial.loadWantToPlayIds);
    expect(view.result.current.lists.setWantToPlay).toBe(initial.setWantToPlay);
  });
});
