import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/features/auth/context/AuthProvider';

import type { ListsRepository } from '@/features/lists/api/lists-repository';
import type { CreateListInput, GameSnapshot, UserListSummary } from '@/features/lists/model/lists';

export type ListsState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly lists: readonly UserListSummary[] }
  | { readonly status: 'error'; readonly message: string };

export type WantToPlayMembershipStatus = 'loading' | 'ready' | 'error';

export interface ListsContextValue {
  readonly listsState: ListsState;
  readonly scopeVersion: number;
  readonly wantToPlayIds: ReadonlySet<number>;
  readonly wantToPlayMemberships: ReadonlyMap<number, WantToPlayMembershipStatus>;
  readonly addGameToLists: (game: GameSnapshot, listIds: readonly number[]) => Promise<void>;
  readonly createList: (input: CreateListInput) => Promise<UserListSummary>;
  readonly loadLists: (options?: { readonly force?: boolean }) => Promise<void>;
  readonly loadWantToPlayIds: (igdbIds: readonly number[]) => Promise<void>;
  readonly setWantToPlay: (game: GameSnapshot, desired: boolean) => Promise<boolean>;
}

interface ListsProviderProps {
  readonly children: ReactNode;
  readonly repository: ListsRepository | null;
}

interface ScopedState {
  readonly listsState: ListsState;
  readonly repository: ListsRepository | null;
  readonly scopeVersion: number;
  readonly userId: string | null;
  readonly wantToPlayIds: ReadonlySet<number>;
  readonly wantToPlayMemberships: ReadonlyMap<number, WantToPlayMembershipStatus>;
}

interface ActiveScope {
  active: boolean;
  listsState: ListsState;
  readonly repository: ListsRepository | null;
  readonly scopeVersion: number;
  readonly userId: string | null;
}

interface ScopedPromise {
  readonly promise: Promise<void>;
  readonly scope: ActiveScope;
}

interface MutationPromise {
  readonly promise: Promise<boolean>;
  readonly scope: ActiveScope;
}

export const LISTS_CONFIGURATION_ERROR_MESSAGE = 'As listas ainda não estão configuradas.';

const listsLoadErrorMessage = 'Não foi possível carregar suas listas. Tente novamente.';
const authenticationErrorMessage = 'Entre para acessar suas listas.';
const idleListsState: ListsState = { status: 'idle' };

class ListsOperationCancelledError extends Error {
  constructor() {
    super('List operation cancelled.');
    this.name = 'ListsOperationCancelledError';
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function isListsOperationCancelled(error: unknown): boolean {
  return error instanceof ListsOperationCancelledError;
}

function configurationError(): Error {
  return new Error(LISTS_CONFIGURATION_ERROR_MESSAGE);
}

function unavailableAction(): Promise<never> {
  return Promise.reject(configurationError());
}

function initialScopedState(
  repository: ListsRepository | null,
  userId: string | null,
  scopeVersion: number,
): ScopedState {
  return {
    listsState: idleListsState,
    repository,
    scopeVersion,
    userId,
    wantToPlayIds: new Set<number>(),
    wantToPlayMemberships: new Map<number, WantToPlayMembershipStatus>(),
  };
}

const defaultListsContext: ListsContextValue = {
  listsState: idleListsState,
  scopeVersion: 0,
  wantToPlayIds: new Set<number>(),
  wantToPlayMemberships: new Map<number, WantToPlayMembershipStatus>(),
  addGameToLists: unavailableAction,
  createList: unavailableAction,
  loadLists: unavailableAction,
  loadWantToPlayIds: unavailableAction,
  setWantToPlay: unavailableAction,
};

const ListsContext = createContext<ListsContextValue>(defaultListsContext);

export function ListsProvider({ children, repository }: ListsProviderProps) {
  const { state: authState } = useAuth();
  const userId = authState.status === 'authenticated' ? authState.user.id : null;
  const [scopedState, setScopedState] = useState(() => initialScopedState(repository, userId, 0));

  if (scopedState.repository !== repository || scopedState.userId !== userId) {
    setScopedState(initialScopedState(repository, userId, scopedState.scopeVersion + 1));
  }

  const activeScopeRef = useRef<ActiveScope | null>(null);
  const listRequestRef = useRef(0);
  const listInFlightRef = useRef<ScopedPromise | null>(null);
  const membershipLoadTokensRef = useRef(new Map<number, number>());
  const confirmedMutationVersionsRef = useRef(new Map<number, number>());
  const mutationQueueRef = useRef(new Map<number, MutationPromise>());

  useLayoutEffect(() => {
    const membershipLoadTokens = membershipLoadTokensRef.current;
    const confirmedMutationVersions = confirmedMutationVersionsRef.current;
    const mutationQueue = mutationQueueRef.current;
    const scope: ActiveScope = {
      active: true,
      listsState: idleListsState,
      repository,
      scopeVersion: scopedState.scopeVersion,
      userId,
    };
    activeScopeRef.current = scope;
    listRequestRef.current = 0;
    listInFlightRef.current = null;
    membershipLoadTokens.clear();
    confirmedMutationVersions.clear();
    mutationQueue.clear();

    return () => {
      scope.active = false;
      if (activeScopeRef.current === scope) activeScopeRef.current = null;
      listInFlightRef.current = null;
      membershipLoadTokens.clear();
      confirmedMutationVersions.clear();
      mutationQueue.clear();
    };
  }, [repository, scopedState.scopeVersion, userId]);

  const isCurrentScope = useCallback(
    (scope: ActiveScope) => scope.active && activeScopeRef.current === scope,
    [],
  );

  const requireScope = useCallback((): ActiveScope => {
    const scope = activeScopeRef.current;
    if (!scope?.active) throw new ListsOperationCancelledError();
    if (scope.repository === null) throw configurationError();
    if (scope.userId === null) throw new Error(authenticationErrorMessage);
    return scope;
  }, []);

  const assertCurrentScope = useCallback(
    (scope: ActiveScope): void => {
      if (!isCurrentScope(scope)) throw new ListsOperationCancelledError();
    },
    [isCurrentScope],
  );

  const publishListsState = useCallback(
    (scope: ActiveScope, nextState: ListsState) => {
      if (!isCurrentScope(scope)) return;
      scope.listsState = nextState;
      setScopedState((current) =>
        current.scopeVersion === scope.scopeVersion
          ? { ...current, listsState: nextState }
          : current,
      );
    },
    [isCurrentScope],
  );

  const publishWantToPlayState = useCallback(
    (
      scope: ActiveScope,
      update: (current: {
        readonly ids: ReadonlySet<number>;
        readonly memberships: ReadonlyMap<number, WantToPlayMembershipStatus>;
      }) => {
        readonly ids: ReadonlySet<number>;
        readonly memberships: ReadonlyMap<number, WantToPlayMembershipStatus>;
      },
    ) => {
      if (!isCurrentScope(scope)) return;
      setScopedState((current) =>
        current.scopeVersion === scope.scopeVersion
          ? (() => {
              const next = update({
                ids: current.wantToPlayIds,
                memberships: current.wantToPlayMemberships,
              });
              return {
                ...current,
                wantToPlayIds: next.ids,
                wantToPlayMemberships: next.memberships,
              };
            })()
          : current,
      );
    },
    [isCurrentScope],
  );

  const loadListsForScope = useCallback(
    async (scope: ActiveScope, force: boolean): Promise<void> => {
      if (scope.repository === null) {
        publishListsState(scope, {
          status: 'error',
          message: LISTS_CONFIGURATION_ERROR_MESSAGE,
        });
        return;
      }
      if (scope.userId === null) {
        publishListsState(scope, { status: 'error', message: authenticationErrorMessage });
        return;
      }
      if (!force && scope.listsState.status === 'success') return;
      const inFlight = listInFlightRef.current;
      if (!force && inFlight?.scope === scope) return inFlight.promise;

      const request = listRequestRef.current + 1;
      listRequestRef.current = request;
      if (scope.listsState.status !== 'success') publishListsState(scope, { status: 'loading' });

      const operation = scope.repository
        .listSummaries()
        .then((lists) => {
          if (isCurrentScope(scope) && request === listRequestRef.current) {
            publishListsState(scope, { status: 'success', lists });
          }
        })
        .catch(() => {
          if (isCurrentScope(scope) && request === listRequestRef.current) {
            publishListsState(scope, { status: 'error', message: listsLoadErrorMessage });
          }
        })
        .finally(() => {
          if (listInFlightRef.current?.promise === operation) listInFlightRef.current = null;
        });

      listInFlightRef.current = { promise: operation, scope };
      return operation;
    },
    [isCurrentScope, publishListsState],
  );

  const loadLists = useCallback<ListsContextValue['loadLists']>(
    async (options) => {
      const scope = activeScopeRef.current;
      if (!scope?.active) return;
      await loadListsForScope(scope, options?.force === true);
    },
    [loadListsForScope],
  );

  const createList = useCallback<ListsContextValue['createList']>(
    async (input) => {
      const scope = requireScope();
      const repositoryForScope = scope.repository;
      const userIdForScope = scope.userId;
      if (repositoryForScope === null) throw configurationError();
      if (userIdForScope === null) throw new Error(authenticationErrorMessage);

      let createdList: UserListSummary;
      try {
        createdList = await repositoryForScope.createList(userIdForScope, input);
      } catch (error) {
        if (!isCurrentScope(scope)) throw new ListsOperationCancelledError();
        throw error;
      }
      assertCurrentScope(scope);

      const currentLists = scope.listsState.status === 'success' ? scope.listsState.lists : [];
      const nextLists = currentLists.some((list) => list.id === createdList.id)
        ? currentLists.map((list) => (list.id === createdList.id ? createdList : list))
        : [...currentLists, createdList];
      publishListsState(scope, { status: 'success', lists: nextLists });
      await loadListsForScope(scope, true);
      assertCurrentScope(scope);
      return createdList;
    },
    [assertCurrentScope, isCurrentScope, loadListsForScope, publishListsState, requireScope],
  );

  const addGameToLists = useCallback<ListsContextValue['addGameToLists']>(
    async (game, listIds) => {
      const scope = requireScope();
      const repositoryForScope = scope.repository;
      if (repositoryForScope === null) throw configurationError();

      try {
        await repositoryForScope.addGameToLists(game, listIds);
      } catch (error) {
        if (!isCurrentScope(scope)) throw new ListsOperationCancelledError();
        throw error;
      }
      assertCurrentScope(scope);
      await loadListsForScope(scope, true);
      assertCurrentScope(scope);
    },
    [assertCurrentScope, isCurrentScope, loadListsForScope, requireScope],
  );

  const loadWantToPlayIds = useCallback<ListsContextValue['loadWantToPlayIds']>(
    async (igdbIds) => {
      const scope = requireScope();
      const repositoryForScope = scope.repository;
      if (repositoryForScope === null) throw configurationError();

      const uniqueIds = [...new Set(igdbIds)];
      if (uniqueIds.length === 0) return;
      const loadTokens = new Map<number, number>();
      const confirmedMutationVersions = new Map<number, number>();
      for (const igdbId of uniqueIds) {
        const loadToken = (membershipLoadTokensRef.current.get(igdbId) ?? 0) + 1;
        membershipLoadTokensRef.current.set(igdbId, loadToken);
        loadTokens.set(igdbId, loadToken);
        confirmedMutationVersions.set(
          igdbId,
          confirmedMutationVersionsRef.current.get(igdbId) ?? 0,
        );
      }

      publishWantToPlayState(scope, (current) => {
        const memberships = new Map(current.memberships);
        for (const igdbId of uniqueIds) memberships.set(igdbId, 'loading');
        return { ids: current.ids, memberships };
      });

      let loadedIds: ReadonlySet<number>;
      try {
        loadedIds = await repositoryForScope.getWantToPlayIds(uniqueIds);
      } catch (error) {
        if (!isCurrentScope(scope)) throw new ListsOperationCancelledError();
        publishWantToPlayState(scope, (current) => {
          const memberships = new Map(current.memberships);
          for (const igdbId of uniqueIds) {
            const isNewestLoad =
              membershipLoadTokensRef.current.get(igdbId) === loadTokens.get(igdbId);
            const hasNoNewConfirmation =
              (confirmedMutationVersionsRef.current.get(igdbId) ?? 0) ===
              confirmedMutationVersions.get(igdbId);
            if (isNewestLoad && hasNoNewConfirmation) memberships.set(igdbId, 'error');
          }
          return { ids: current.ids, memberships };
        });
        throw error;
      }
      if (!isCurrentScope(scope)) return;

      publishWantToPlayState(scope, (current) => {
        const ids = new Set(current.ids);
        const memberships = new Map(current.memberships);
        for (const igdbId of uniqueIds) {
          const isNewestLoad =
            membershipLoadTokensRef.current.get(igdbId) === loadTokens.get(igdbId);
          const hasNoNewConfirmation =
            (confirmedMutationVersionsRef.current.get(igdbId) ?? 0) ===
            confirmedMutationVersions.get(igdbId);
          if (!isNewestLoad || !hasNoNewConfirmation) {
            continue;
          }
          ids.delete(igdbId);
          if (loadedIds.has(igdbId)) ids.add(igdbId);
          memberships.set(igdbId, 'ready');
        }
        return { ids, memberships };
      });
    },
    [isCurrentScope, publishWantToPlayState, requireScope],
  );

  const setWantToPlay = useCallback<ListsContextValue['setWantToPlay']>(
    async (game, desired) => {
      const scope = requireScope();
      const repositoryForScope = scope.repository;
      if (repositoryForScope === null) throw configurationError();

      const previous = mutationQueueRef.current.get(game.igdbId);
      const execute = () => {
        assertCurrentScope(scope);
        return repositoryForScope.setWantToPlay(game, desired).then((isWantToPlay) => {
          assertCurrentScope(scope);
          const confirmedVersion = (confirmedMutationVersionsRef.current.get(game.igdbId) ?? 0) + 1;
          confirmedMutationVersionsRef.current.set(game.igdbId, confirmedVersion);
          publishWantToPlayState(scope, (current) => {
            const ids = new Set(current.ids);
            const memberships = new Map(current.memberships);
            if (isWantToPlay) ids.add(game.igdbId);
            else ids.delete(game.igdbId);
            memberships.set(game.igdbId, 'ready');
            return { ids, memberships };
          });
          return isWantToPlay;
        });
      };
      const operation = (
        previous?.scope === scope ? previous.promise.then(execute, execute) : execute()
      )
        .catch((error: unknown) => {
          if (!isCurrentScope(scope)) throw new ListsOperationCancelledError();
          throw error;
        })
        .finally(() => {
          if (mutationQueueRef.current.get(game.igdbId)?.promise === operation) {
            mutationQueueRef.current.delete(game.igdbId);
          }
        });

      mutationQueueRef.current.set(game.igdbId, { promise: operation, scope });
      return operation;
    },
    [assertCurrentScope, isCurrentScope, publishWantToPlayState, requireScope],
  );

  const value = useMemo<ListsContextValue>(
    () => ({
      addGameToLists,
      createList,
      listsState: scopedState.listsState,
      loadLists,
      loadWantToPlayIds,
      scopeVersion: scopedState.scopeVersion,
      setWantToPlay,
      wantToPlayIds: scopedState.wantToPlayIds,
      wantToPlayMemberships: scopedState.wantToPlayMemberships,
    }),
    [
      addGameToLists,
      createList,
      loadLists,
      loadWantToPlayIds,
      scopedState.listsState,
      scopedState.scopeVersion,
      scopedState.wantToPlayIds,
      scopedState.wantToPlayMemberships,
      setWantToPlay,
    ],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLists(): ListsContextValue {
  return useContext(ListsContext);
}
