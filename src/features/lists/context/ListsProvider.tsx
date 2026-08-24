import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
interface ScopedListsProviderProps extends ListsProviderProps {
  readonly userId: string | null;
}

export const LISTS_CONFIGURATION_ERROR_MESSAGE = 'As listas ainda não estão configuradas.';

const listsLoadErrorMessage = 'Não foi possível carregar suas listas. Tente novamente.';
const authenticationErrorMessage = 'Entre para acessar suas listas.';
const idleListsState: ListsState = { status: 'idle' };
const repositoryKeys = new WeakMap<ListsRepository, number>();
let nextRepositoryKey = 1;

function getRepositoryKey(repository: ListsRepository | null): string {
  if (repository === null) return 'unconfigured';
  const existingKey = repositoryKeys.get(repository);
  if (existingKey !== undefined) return String(existingKey);
  const key = nextRepositoryKey;
  nextRepositoryKey += 1;
  repositoryKeys.set(repository, key);
  return String(key);
}

function configurationError(): Error {
  return new Error(LISTS_CONFIGURATION_ERROR_MESSAGE);
}

function unavailableAction(): Promise<never> {
  return Promise.reject(configurationError());
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

  return (
    <ScopedListsProvider
      key={`${userId ?? 'anonymous'}:${getRepositoryKey(repository)}`}
      repository={repository}
      userId={userId}
    >
      {children}
    </ScopedListsProvider>
  );
}

function ScopedListsProvider({ children, repository, userId }: ScopedListsProviderProps) {
  const [listsState, setListsState] = useState<ListsState>(idleListsState);
  const [wantToPlayIds, setWantToPlayIds] = useState<ReadonlySet<number>>(() => new Set<number>());
  const listsStateRef = useRef<ListsState>(idleListsState);
  const repositoryRef = useRef<ListsRepository | null>(repository);
  const userIdRef = useRef<string | null>(userId);
  const generationRef = useRef(0);
  const listRequestRef = useRef(0);
  const membershipRequestRef = useRef(0);
  const membershipVersionsRef = useRef(new Map<number, number>());
  const listInFlightRef = useRef<Promise<void> | null>(null);

  const publishListsState = useCallback((nextState: ListsState) => {
    listsStateRef.current = nextState;
    setListsState(nextState);
  }, []);

  useEffect(() => {
    const membershipVersions = membershipVersionsRef.current;
    return () => {
      generationRef.current += 1;
      listRequestRef.current += 1;
      membershipRequestRef.current += 1;
      membershipVersions.clear();
      listInFlightRef.current = null;
      userIdRef.current = null;
    };
  }, []);

  const loadLists = useCallback<ListsContextValue['loadLists']>(
    async (options) => {
      const force = options?.force === true;
      if (!force && listsStateRef.current.status === 'success') return;
      if (!force && listInFlightRef.current !== null) return listInFlightRef.current;

      const currentRepository = repositoryRef.current;
      const currentUserId = userIdRef.current;
      if (currentRepository === null) {
        publishListsState({ status: 'error', message: LISTS_CONFIGURATION_ERROR_MESSAGE });
        return;
      }
      if (currentUserId === null) {
        publishListsState({ status: 'error', message: authenticationErrorMessage });
        return;
      }

      const generation = generationRef.current;
      const request = listRequestRef.current + 1;
      listRequestRef.current = request;
      if (listsStateRef.current.status !== 'success') publishListsState({ status: 'loading' });

      const operation = currentRepository
        .listSummaries()
        .then((lists) => {
          if (generation === generationRef.current && request === listRequestRef.current) {
            publishListsState({ status: 'success', lists });
          }
        })
        .catch(() => {
          if (generation === generationRef.current && request === listRequestRef.current) {
            publishListsState({ status: 'error', message: listsLoadErrorMessage });
          }
        })
        .finally(() => {
          if (listInFlightRef.current === operation) listInFlightRef.current = null;
        });

      listInFlightRef.current = operation;
      return operation;
    },
    [publishListsState],
  );

  const createList = useCallback<ListsContextValue['createList']>(
    async (input) => {
      const currentRepository = repositoryRef.current;
      const currentUserId = userIdRef.current;
      if (currentRepository === null) throw configurationError();
      if (currentUserId === null) throw new Error(authenticationErrorMessage);

      const generation = generationRef.current;
      const createdList = await currentRepository.createList(currentUserId, input);
      if (generation !== generationRef.current || currentUserId !== userIdRef.current) {
        return createdList;
      }

      const currentState = listsStateRef.current;
      const currentLists = currentState.status === 'success' ? currentState.lists : [];
      const nextLists = currentLists.some((list) => list.id === createdList.id)
        ? currentLists.map((list) => (list.id === createdList.id ? createdList : list))
        : [...currentLists, createdList];
      publishListsState({ status: 'success', lists: nextLists });
      await loadLists({ force: true });
      return createdList;
    },
    [loadLists, publishListsState],
  );

  const addGameToLists = useCallback<ListsContextValue['addGameToLists']>(
    async (game, listIds) => {
      const currentRepository = repositoryRef.current;
      const currentUserId = userIdRef.current;
      if (currentRepository === null) throw configurationError();
      if (currentUserId === null) throw new Error(authenticationErrorMessage);

      const generation = generationRef.current;
      await currentRepository.addGameToLists(game, listIds);
      if (generation === generationRef.current && currentUserId === userIdRef.current) {
        await loadLists({ force: true });
      }
    },
    [loadLists],
  );

  const loadWantToPlayIds = useCallback<ListsContextValue['loadWantToPlayIds']>(async (igdbIds) => {
    const currentRepository = repositoryRef.current;
    const currentUserId = userIdRef.current;
    if (currentRepository === null) throw configurationError();
    if (currentUserId === null) throw new Error(authenticationErrorMessage);

    const uniqueIds = [...new Set(igdbIds)];
    if (uniqueIds.length === 0) return;

    const generation = generationRef.current;
    const request = membershipRequestRef.current + 1;
    membershipRequestRef.current = request;
    for (const igdbId of uniqueIds) membershipVersionsRef.current.set(igdbId, request);

    const loadedIds = await currentRepository.getWantToPlayIds(uniqueIds);
    if (generation !== generationRef.current || currentUserId !== userIdRef.current) return;

    setWantToPlayIds((current) => {
      const next = new Set(current);
      for (const igdbId of uniqueIds) {
        if (membershipVersionsRef.current.get(igdbId) !== request) continue;
        next.delete(igdbId);
        if (loadedIds.has(igdbId)) next.add(igdbId);
      }
      return next;
    });
  }, []);

  const toggleWantToPlay = useCallback<ListsContextValue['toggleWantToPlay']>(async (game) => {
    const currentRepository = repositoryRef.current;
    const currentUserId = userIdRef.current;
    if (currentRepository === null) throw configurationError();
    if (currentUserId === null) throw new Error(authenticationErrorMessage);

    const generation = generationRef.current;
    const request = membershipRequestRef.current + 1;
    membershipRequestRef.current = request;
    membershipVersionsRef.current.set(game.igdbId, request);
    const isWantToPlay = await currentRepository.toggleWantToPlay(game);
    if (
      generation === generationRef.current &&
      currentUserId === userIdRef.current &&
      membershipVersionsRef.current.get(game.igdbId) === request
    ) {
      setWantToPlayIds((current) => {
        const next = new Set(current);
        if (isWantToPlay) next.add(game.igdbId);
        else next.delete(game.igdbId);
        return next;
      });
    }
    return isWantToPlay;
  }, []);

  const value = useMemo<ListsContextValue>(
    () => ({
      addGameToLists,
      createList,
      listsState,
      loadLists,
      loadWantToPlayIds,
      toggleWantToPlay,
      wantToPlayIds,
    }),
    [
      addGameToLists,
      createList,
      listsState,
      loadLists,
      loadWantToPlayIds,
      toggleWantToPlay,
      wantToPlayIds,
    ],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLists(): ListsContextValue {
  return useContext(ListsContext);
}
