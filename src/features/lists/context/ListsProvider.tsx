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

export interface ListsContextValue {
  readonly listsState: ListsState;
  readonly wantToPlayIds: ReadonlySet<number>;
  readonly addGameToLists: (game: GameSnapshot, listIds: readonly number[]) => Promise<void>;
  readonly createList: (input: CreateListInput) => Promise<UserListSummary>;
  readonly loadLists: (options?: { readonly force?: boolean }) => Promise<void>;
  readonly loadWantToPlayIds: (igdbIds: readonly number[]) => Promise<void>;
  readonly toggleWantToPlay: (game: GameSnapshot) => Promise<boolean>;
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

interface TogglePromise {
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
  };
}

const defaultListsContext: ListsContextValue = {
  listsState: idleListsState,
  wantToPlayIds: new Set<number>(),
  addGameToLists: unavailableAction,
  createList: unavailableAction,
  loadLists: unavailableAction,
  loadWantToPlayIds: unavailableAction,
  toggleWantToPlay: unavailableAction,
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
  const membershipVersionsRef = useRef(new Map<number, number>());
  const toggleInFlightRef = useRef(new Map<number, TogglePromise>());

  useLayoutEffect(() => {
    const membershipVersions = membershipVersionsRef.current;
    const toggleInFlight = toggleInFlightRef.current;
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
    membershipVersions.clear();
    toggleInFlight.clear();

    return () => {
      scope.active = false;
      if (activeScopeRef.current === scope) activeScopeRef.current = null;
      listInFlightRef.current = null;
      membershipVersions.clear();
      toggleInFlight.clear();
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

  const publishWantToPlayIds = useCallback(
    (scope: ActiveScope, update: (current: ReadonlySet<number>) => ReadonlySet<number>) => {
      if (!isCurrentScope(scope)) return;
      setScopedState((current) =>
        current.scopeVersion === scope.scopeVersion
          ? { ...current, wantToPlayIds: update(current.wantToPlayIds) }
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

      const createdList = await repositoryForScope.createList(userIdForScope, input);
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
    [assertCurrentScope, loadListsForScope, publishListsState, requireScope],
  );

  const addGameToLists = useCallback<ListsContextValue['addGameToLists']>(
    async (game, listIds) => {
      const scope = requireScope();
      const repositoryForScope = scope.repository;
      if (repositoryForScope === null) throw configurationError();

      await repositoryForScope.addGameToLists(game, listIds);
      assertCurrentScope(scope);
      await loadListsForScope(scope, true);
      assertCurrentScope(scope);
    },
    [assertCurrentScope, loadListsForScope, requireScope],
  );

  const loadWantToPlayIds = useCallback<ListsContextValue['loadWantToPlayIds']>(
    async (igdbIds) => {
      const scope = requireScope();
      const repositoryForScope = scope.repository;
      if (repositoryForScope === null) throw configurationError();

      const uniqueIds = [...new Set(igdbIds)];
      if (uniqueIds.length === 0) return;
      const versionsAtStart = new Map(
        uniqueIds.map((igdbId) => [igdbId, membershipVersionsRef.current.get(igdbId) ?? 0]),
      );

      const loadedIds = await repositoryForScope.getWantToPlayIds(uniqueIds);
      if (!isCurrentScope(scope)) return;

      publishWantToPlayIds(scope, (current) => {
        const next = new Set(current);
        for (const igdbId of uniqueIds) {
          if ((membershipVersionsRef.current.get(igdbId) ?? 0) !== versionsAtStart.get(igdbId)) {
            continue;
          }
          next.delete(igdbId);
          if (loadedIds.has(igdbId)) next.add(igdbId);
        }
        return next;
      });
    },
    [isCurrentScope, publishWantToPlayIds, requireScope],
  );

  const toggleWantToPlay = useCallback<ListsContextValue['toggleWantToPlay']>(
    async (game) => {
      const scope = requireScope();
      const repositoryForScope = scope.repository;
      if (repositoryForScope === null) throw configurationError();

      const existing = toggleInFlightRef.current.get(game.igdbId);
      if (existing?.scope === scope) return existing.promise;

      const bumpMembershipVersion = () => {
        const currentVersion = membershipVersionsRef.current.get(game.igdbId) ?? 0;
        membershipVersionsRef.current.set(game.igdbId, currentVersion + 1);
      };
      bumpMembershipVersion();

      const operation = repositoryForScope
        .toggleWantToPlay(game)
        .then((isWantToPlay) => {
          assertCurrentScope(scope);
          bumpMembershipVersion();
          publishWantToPlayIds(scope, (current) => {
            const next = new Set(current);
            if (isWantToPlay) next.add(game.igdbId);
            else next.delete(game.igdbId);
            return next;
          });
          return isWantToPlay;
        })
        .catch((error: unknown) => {
          if (!isCurrentScope(scope)) throw new ListsOperationCancelledError();
          bumpMembershipVersion();
          throw error;
        })
        .finally(() => {
          if (toggleInFlightRef.current.get(game.igdbId)?.promise === operation) {
            toggleInFlightRef.current.delete(game.igdbId);
          }
        });

      toggleInFlightRef.current.set(game.igdbId, { promise: operation, scope });
      return operation;
    },
    [assertCurrentScope, isCurrentScope, publishWantToPlayIds, requireScope],
  );

  const value = useMemo<ListsContextValue>(
    () => ({
      addGameToLists,
      createList,
      listsState: scopedState.listsState,
      loadLists,
      loadWantToPlayIds,
      toggleWantToPlay,
      wantToPlayIds: scopedState.wantToPlayIds,
    }),
    [
      addGameToLists,
      createList,
      loadLists,
      loadWantToPlayIds,
      scopedState.listsState,
      scopedState.wantToPlayIds,
      toggleWantToPlay,
    ],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLists(): ListsContextValue {
  return useContext(ListsContext);
}
