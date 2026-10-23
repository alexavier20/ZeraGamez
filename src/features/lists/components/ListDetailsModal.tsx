import {
  CalendarDays,
  Gamepad2,
  Grid2X2,
  Image,
  List as ListIcon,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ZodError } from 'zod';

import { isListsOperationCancelled } from '@/features/lists/context/ListsProvider';
import { normalizeCreateListInput } from '@/features/lists/model/lists';
import { DataError } from '@/shared/supabase/data-error';

import type { ListGame, UserListSummary, CreateListInput } from '@/features/lists/model/lists';

interface ListDetailsModalProps {
  readonly list: UserListSummary;
  readonly onAddGames: () => void;
  readonly onClose: () => void;
  readonly onLoadCoverGameIds: (listId: number) => Promise<readonly number[]>;
  readonly onLoadGames: (listId: number) => Promise<readonly ListGame[]>;
  readonly onMoveGame: (listId: number, igdbId: number, position: number) => Promise<void>;
  readonly onRemoveGame: (listId: number, igdbId: number) => Promise<boolean>;
  readonly onSetCoverGameIds: (listId: number, igdbIds: readonly number[]) => Promise<void>;
  readonly onUpdate: (listId: number, input: CreateListInput) => Promise<void>;
}

type GamesState =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly games: readonly ListGame[] }
  | { readonly status: 'error' };

type CoverSelectionState =
  | { readonly listId: number; readonly status: 'loading' }
  | { readonly ids: readonly number[]; readonly listId: number; readonly status: 'success' }
  | { readonly listId: number; readonly status: 'error' };

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const gameLoadErrorMessage = 'Não foi possível carregar os jogos desta lista. Tente novamente.';

function formatReleaseDate(value: string | null): string {
  if (value === null) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function ListDetailsDialog({
  list,
  onAddGames,
  onClose,
  onLoadCoverGameIds,
  onLoadGames,
  onMoveGame,
  onRemoveGame,
  onSetCoverGameIds,
  onUpdate,
}: ListDetailsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const gamesScrollContainerRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const swapFeedbackTimeoutRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const [gamesState, setGamesState] = useState<GamesState>({ status: 'loading' });
  const [coverSelectionState, setCoverSelectionState] = useState<CoverSelectionState>({
    listId: list.id,
    status: 'loading',
  });
  const [coverSelectionSaving, setCoverSelectionSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? '');
  const [saving, setSaving] = useState(false);
  const [busyGameId, setBusyGameId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedGameId, setDraggedGameId] = useState<number | null>(null);
  const [gamesView, setGamesView] = useState<'grid' | 'list'>('list');
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [swappedGameIds, setSwappedGameIds] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentCoverSelection =
    coverSelectionState.listId === list.id
      ? coverSelectionState
      : ({ listId: list.id, status: 'loading' } as const);
  const selectedCoverIds =
    currentCoverSelection.status === 'success' ? currentCoverSelection.ids : [];
  const coverSelectionLoading = currentCoverSelection.status === 'loading';
  const coverSelectionError = currentCoverSelection.status === 'error';

  const loadCoverSelection = useCallback(async () => {
    try {
      const ids = await onLoadCoverGameIds(list.id);
      setCoverSelectionState({ ids, listId: list.id, status: 'success' });
    } catch (error) {
      if (!isListsOperationCancelled(error)) {
        setCoverSelectionState({ listId: list.id, status: 'error' });
      }
    }
  }, [list.id, onLoadCoverGameIds]);

  const loadGames = async () => {
    setGamesState({ status: 'loading' });
    setErrorMessage(null);
    try {
      const games = await onLoadGames(list.id);
      setGamesState({ status: 'success', games });
    } catch (error) {
      if (isListsOperationCancelled(error)) return;
      setGamesState({ status: 'error' });
    }
  };

  useEffect(() => {
    let isActive = true;
    void onLoadGames(list.id)
      .then((games) => {
        if (isActive) setGamesState({ status: 'success', games });
      })
      .catch((error: unknown) => {
        if (isActive && !isListsOperationCancelled(error)) setGamesState({ status: 'error' });
      });

    return () => {
      isActive = false;
    };
  }, [list.id, onLoadGames]);

  useEffect(() => {
    let isActive = true;
    void onLoadCoverGameIds(list.id)
      .then((ids) => {
        if (isActive) setCoverSelectionState({ ids, listId: list.id, status: 'success' });
      })
      .catch((error: unknown) => {
        if (isActive && !isListsOperationCancelled(error)) {
          setCoverSelectionState({ listId: list.id, status: 'error' });
        }
      });

    return () => {
      isActive = false;
    };
  }, [list.id, onLoadCoverGameIds]);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  useEffect(
    () => () => {
      if (swapFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(swapFeedbackTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusTo =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    firstActionRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      const first = controls.at(0);
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (!controls.includes(document.activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    };
  }, [onClose]);

  const saveList = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;

    let normalized: CreateListInput;
    try {
      normalized = normalizeCreateListInput({ name, description });
    } catch (error) {
      setErrorMessage(
        error instanceof ZodError
          ? (error.issues[0]?.message ?? 'Confira os dados.')
          : 'Confira os dados.',
      );
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setErrorMessage(null);
    try {
      await onUpdate(list.id, normalized);
      setName(normalized.name);
      setDescription(normalized.description);
      setEditing(false);
    } catch (error) {
      if (!isListsOperationCancelled(error)) {
        setErrorMessage(
          error instanceof DataError &&
            (error.code === 'list_name_conflict' || error.code === 'list_name_reserved')
            ? error.message
            : 'Não foi possível salvar as alterações. Tente novamente.',
        );
      }
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const removeGame = async (game: ListGame) => {
    if (busyRef.current) return;

    busyRef.current = true;
    setBusyGameId(game.igdbId);
    setErrorMessage(null);
    try {
      await onRemoveGame(list.id, game.igdbId);
      setGamesState((current) =>
        current.status === 'success'
          ? {
              status: 'success',
              games: current.games.filter((item) => item.igdbId !== game.igdbId),
            }
          : current,
      );
      setCoverSelectionState((current) =>
        current.listId === list.id && current.status === 'success'
          ? {
              ...current,
              ids: current.ids.filter((igdbId) => igdbId !== game.igdbId),
            }
          : current,
      );
    } catch (error) {
      if (!isListsOperationCancelled(error)) {
        setErrorMessage(`Não foi possível remover “${game.name}”. Tente novamente.`);
      }
    } finally {
      busyRef.current = false;
      setBusyGameId(null);
    }
  };

  const toggleCoverGame = async (game: ListGame) => {
    if (busyRef.current || coverSelectionLoading || coverSelectionError || game.coverUrl === null) {
      return;
    }

    const isSelected = selectedCoverIds.includes(game.igdbId);
    if (!isSelected && selectedCoverIds.length >= 3) return;
    const nextIds = isSelected
      ? selectedCoverIds.filter((igdbId) => igdbId !== game.igdbId)
      : [...selectedCoverIds, game.igdbId];

    busyRef.current = true;
    setCoverSelectionSaving(true);
    setErrorMessage(null);
    try {
      await onSetCoverGameIds(list.id, nextIds);
      setCoverSelectionState({ ids: nextIds, listId: list.id, status: 'success' });
    } catch (error) {
      if (!isListsOperationCancelled(error)) {
        setErrorMessage('Não foi possível atualizar as capas da lista. Tente novamente.');
      }
    } finally {
      busyRef.current = false;
      setCoverSelectionSaving(false);
    }
  };

  const covers = list.covers
    .filter((cover): cover is string => typeof cover === 'string' && cover.length > 0)
    .slice(0, 3);
  const games = gamesState.status === 'success' ? gamesState.games : [];
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const visibleGames = games.filter((game) =>
    game.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  );
  const canReorder =
    normalizedQuery.length === 0 &&
    games.length > 1 &&
    !saving &&
    busyGameId === null &&
    !isReordering;

  const reorderGame = async (igdbId: number, position: number) => {
    if (busyRef.current || !canReorder) return;

    const currentGames = gamesState.status === 'success' ? gamesState.games : [];
    const currentPosition = currentGames.findIndex((game) => game.igdbId === igdbId);
    if (
      currentPosition < 0 ||
      position < 0 ||
      position >= currentGames.length ||
      currentPosition === position
    ) {
      return;
    }

    const nextGames = [...currentGames];
    const movedGame = currentGames[currentPosition];
    const targetGame = currentGames[position];
    nextGames[currentPosition] = targetGame;
    nextGames[position] = movedGame;

    busyRef.current = true;
    setIsReordering(true);
    setErrorMessage(null);
    setGamesState({ status: 'success', games: nextGames });
    try {
      await onMoveGame(list.id, igdbId, position);
      setReorderAnnouncement(`${movedGame.name} trocou de posição com ${targetGame.name}.`);
      setSwappedGameIds(new Set([movedGame.igdbId, targetGame.igdbId]));
      if (swapFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(swapFeedbackTimeoutRef.current);
      }
      swapFeedbackTimeoutRef.current = window.setTimeout(() => {
        setSwappedGameIds(new Set<number>());
        swapFeedbackTimeoutRef.current = null;
      }, 650);
    } catch (error) {
      if (!isListsOperationCancelled(error)) {
        setGamesState({ status: 'success', games: currentGames });
        setSwappedGameIds(new Set<number>());
        setErrorMessage('Não foi possível reordenar os jogos. Tente novamente.');
      }
    } finally {
      busyRef.current = false;
      setIsReordering(false);
    }
  };

  const swapGames = (draggedId: number, targetId: number) => {
    if (draggedId === targetId || !canReorder) return;

    const targetPosition = games.findIndex((game) => game.igdbId === targetId);
    if (targetPosition < 0) return;
    void reorderGame(draggedId, targetPosition);
  };

  const handleGameDragOver = (event: DragEvent<HTMLDivElement>, gameId: number) => {
    if (!canReorder || draggedGameId === null || draggedGameId === gameId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget((current) => (current === gameId ? current : gameId));
  };

  const handleGamesContainerDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canReorder || draggedGameId === null) return;

    event.preventDefault();
    const scrollContainer = gamesScrollContainerRef.current;
    if (scrollContainer === null) return;

    const bounds = scrollContainer.getBoundingClientRect();
    const edgeSize = Math.min(88, Math.max(48, bounds.height * 0.18));
    const distanceFromTop = event.clientY - bounds.top;
    const distanceFromBottom = bounds.bottom - event.clientY;
    const maxScrollStep = 14;

    if (distanceFromTop >= 0 && distanceFromTop < edgeSize) {
      const intensity = 1 - distanceFromTop / edgeSize;
      scrollContainer.scrollTop -= Math.ceil(maxScrollStep * intensity);
    } else if (distanceFromBottom >= 0 && distanceFromBottom < edgeSize) {
      const intensity = 1 - distanceFromBottom / edgeSize;
      scrollContainer.scrollTop += Math.ceil(maxScrollStep * intensity);
    }
  };

  const handleGameDrop = (event: DragEvent<HTMLDivElement>, gameId: number) => {
    event.preventDefault();
    const droppedId = Number(event.dataTransfer.getData('text/plain'));
    const sourceId = draggedGameId ?? droppedId;
    if (Number.isSafeInteger(sourceId)) swapGames(sourceId, gameId);
    setDraggedGameId(null);
    setDropTarget(null);
  };

  const handleReorderKeyDown = (event: KeyboardEvent<HTMLDivElement>, gameId: number) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const currentPosition = games.findIndex((game) => game.igdbId === gameId);
    void reorderGame(gameId, currentPosition + (event.key === 'ArrowUp' ? -1 : 1));
  };

  const modal = (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto px-3 py-4 sm:px-6 sm:py-8">
      <button
        aria-label="Fechar detalhes da lista"
        className="absolute inset-0 size-full bg-black/75 disabled:cursor-not-allowed"
        disabled={saving || busyGameId !== null || isReordering}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-busy={saving || busyGameId !== null || isReordering || undefined}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-10 my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[1052px] flex-col overflow-hidden rounded-2xl border border-border-brand bg-surface shadow-[0_14px_36px_#00000077] sm:max-h-[calc(100dvh-4rem)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="relative border-b border-border-brand bg-gradient-to-br from-brand/10 via-surface to-surface px-5 py-5 sm:px-7 sm:py-6">
          <button
            aria-label="Fechar modal"
            className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-xl bg-bg-secondary text-text-muted transition-colors hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand"
            disabled={saving || busyGameId !== null || isReordering}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
          <div className="flex flex-col gap-5 pr-10 sm:flex-row sm:items-center">
            {covers.length > 0 ? (
              <div className="grid h-36 w-full shrink-0 grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-surface-raised sm:w-52">
                {covers.map((cover, index) => (
                  <img
                    alt={`Capa de ${list.name} ${String(index + 1)}`}
                    className="h-full w-full object-cover"
                    key={`${String(list.id)}:${String(index)}:${cover}`}
                    src={cover}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface-raised text-brand-light sm:h-36 sm:w-52">
                <Gamepad2 aria-hidden="true" size={38} />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <span className="inline-flex rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand-light">
                {list.systemKey === null ? 'Privada' : 'Lista do sistema'}
              </span>
              <h2
                className="break-words font-heading text-2xl font-semibold text-content-primary sm:text-3xl"
                id={titleId}
              >
                {list.name}
              </h2>
              <p className="text-sm leading-6 text-text-muted" id={descriptionId}>
                {list.description === null || list.description.length === 0
                  ? 'Adicione uma descrição para esta lista.'
                  : list.description}
              </p>
              <p className="text-xs font-semibold text-content-primary">
                {gamesState.status === 'success'
                  ? `${String(games.length)} ${games.length === 1 ? 'jogo' : 'jogos'}`
                  : `${String(list.gameCount)} ${list.gameCount === 1 ? 'jogo' : 'jogos'}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:self-start">
              {list.systemKey === null ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-brand bg-bg-secondary px-4 text-sm font-bold text-content-primary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  disabled={saving || busyGameId !== null || isReordering}
                  onClick={() => {
                    setEditing((current) => !current);
                    setErrorMessage(null);
                  }}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={16} />
                  {editing ? 'Cancelar edição' : 'Editar'}
                </button>
              ) : null}
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                disabled={saving || busyGameId !== null || isReordering}
                onClick={onAddGames}
                ref={firstActionRef}
                type="button"
              >
                <Plus aria-hidden="true" size={16} />
                Adicionar jogos
              </button>
            </div>
          </div>
        </header>

        {editing ? (
          <form
            className="space-y-4 border-b border-white/5 px-5 py-5 sm:px-7"
            onSubmit={(event) => {
              void saveList(event);
            }}
          >
            <div>
              <label
                className="mb-2 block text-sm font-bold text-content-primary"
                htmlFor="edit-list-name"
              >
                Nome da lista
              </label>
              <input
                className="min-h-11 w-full rounded-xl border border-white/15 bg-bg-secondary px-4 text-content-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-2 focus:ring-brand/30"
                id="edit-list-name"
                maxLength={80}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                ref={nameInputRef}
                value={name}
              />
            </div>
            <div>
              <label
                className="mb-2 block text-sm font-bold text-content-primary"
                htmlFor="edit-list-description"
              >
                Descrição
              </label>
              <textarea
                className="min-h-24 w-full resize-y rounded-xl border border-white/15 bg-bg-secondary px-4 py-3 text-content-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-2 focus:ring-brand/30"
                id="edit-list-description"
                maxLength={500}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
                value={description}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="min-h-10 rounded-xl border border-border-brand px-4 text-sm font-semibold text-content-primary disabled:opacity-60"
                disabled={saving}
                onClick={() => {
                  setName(list.name);
                  setDescription(list.description ?? '');
                  setEditing(false);
                  setErrorMessage(null);
                }}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
                ) : null}
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        ) : null}

        <section
          aria-label="Jogos da lista"
          className="flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-7"
          id={`${descriptionId}-games`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg font-semibold text-content-primary">Jogos</h3>
              {coverSelectionLoading ? (
                <p className="mt-1 text-xs text-text-muted">Carregando capas escolhidas…</p>
              ) : null}
              {coverSelectionError ? (
                <button
                  className="mt-1 text-xs font-semibold text-red-200 underline underline-offset-2"
                  onClick={() => {
                    setCoverSelectionState({ listId: list.id, status: 'loading' });
                    void loadCoverSelection();
                  }}
                  type="button"
                >
                  Não foi possível carregar as capas. Tentar novamente
                </button>
              ) : null}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
              <label className="flex min-h-10 min-w-[min(100%,18rem)] flex-1 items-center gap-2 rounded-xl border border-border-brand bg-bg-secondary px-3 text-text-muted focus-within:border-brand/70 sm:flex-none">
                <Search aria-hidden="true" size={16} />
                <span className="sr-only">Buscar nesta lista</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-text-muted"
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  placeholder="Buscar nesta lista…"
                  type="search"
                  value={query}
                />
              </label>
              <div
                aria-label="Modo de exibição dos jogos"
                className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-bg-secondary p-1"
                role="group"
              >
                <button
                  aria-controls={`${descriptionId}-games`}
                  aria-pressed={gamesView === 'list'}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${gamesView === 'list' ? 'bg-surface-hover text-content-primary ring-1 ring-inset ring-brand' : 'text-text-muted hover:text-content-primary'}`}
                  onClick={() => {
                    setGamesView('list');
                  }}
                  type="button"
                >
                  <ListIcon aria-hidden="true" size={15} />
                  Lista
                </button>
                <button
                  aria-controls={`${descriptionId}-games`}
                  aria-pressed={gamesView === 'grid'}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${gamesView === 'grid' ? 'bg-surface-hover text-content-primary ring-1 ring-inset ring-brand' : 'text-text-muted hover:text-content-primary'}`}
                  onClick={() => {
                    setGamesView('grid');
                  }}
                  type="button"
                >
                  <Grid2X2 aria-hidden="true" size={15} />
                  Grade
                </button>
              </div>
            </div>
          </div>

          {gamesState.status === 'loading' ? (
            <div
              className="flex min-h-28 items-center justify-center gap-2 text-sm text-text-muted"
              role="status"
            >
              <LoaderCircle aria-hidden="true" className="animate-spin text-brand" size={18} />
              Carregando jogos…
            </div>
          ) : gamesState.status === 'error' ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-center">
              <p className="text-sm text-red-100" role="alert">
                {gameLoadErrorMessage}
              </p>
              <button
                className="mt-3 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-bold text-white"
                onClick={() => {
                  void loadGames();
                }}
                type="button"
              >
                Tentar novamente
              </button>
            </div>
          ) : games.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 px-5 py-8 text-center">
              <Gamepad2 aria-hidden="true" className="mx-auto text-text-muted" size={28} />
              <p className="mt-3 text-sm text-text-muted">Esta lista ainda não tem jogos.</p>
              <button
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white"
                onClick={onAddGames}
                type="button"
              >
                <Plus aria-hidden="true" size={16} /> Adicionar jogos
              </button>
            </div>
          ) : visibleGames.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-text-muted">
              Nenhum jogo corresponde à busca.
            </p>
          ) : (
            <div
              className="min-h-0 overflow-auto rounded-xl border border-border-brand"
              onDragOver={handleGamesContainerDragOver}
              ref={gamesScrollContainerRef}
            >
              {gamesView === 'list' ? (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-border-brand bg-bg-secondary px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)_auto]">
                  <span>Jogo</span>
                  <span className="hidden sm:block">Lançamento</span>
                  <span className="sr-only">Ações</span>
                </div>
              ) : null}
              <ul
                className={
                  gamesView === 'grid'
                    ? 'grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4'
                    : ''
                }
              >
                {visibleGames.map((game) => {
                  const position = games.findIndex((item) => item.igdbId === game.igdbId);
                  const isDropTarget = dropTarget === game.igdbId;
                  const isCoverSelected = selectedCoverIds.includes(game.igdbId);
                  const selectedCoverPosition = selectedCoverIds.indexOf(game.igdbId) + 1;
                  const cannotAddCover = !isCoverSelected && selectedCoverIds.length >= 3;
                  const coverButton =
                    game.coverUrl === null ? null : (
                      <button
                        aria-label={
                          isCoverSelected
                            ? `Remover ${game.name} da capa ${String(selectedCoverPosition)} da lista`
                            : `Usar ${game.name} na capa da lista`
                        }
                        aria-pressed={isCoverSelected}
                        className={
                          gamesView === 'grid'
                            ? `absolute top-2 left-2 z-10 flex size-8 items-center justify-center rounded-lg shadow-lg backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-white ${isCoverSelected ? 'bg-brand text-white' : 'bg-black/65 text-white hover:bg-brand/80'}`
                            : `relative flex size-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand ${isCoverSelected ? 'bg-brand/15 text-brand-light' : 'text-text-muted hover:bg-brand/10 hover:text-brand-light'}`
                        }
                        disabled={
                          coverSelectionLoading ||
                          coverSelectionError ||
                          coverSelectionSaving ||
                          saving ||
                          busyGameId !== null ||
                          isReordering ||
                          cannotAddCover
                        }
                        onClick={() => {
                          void toggleCoverGame(game);
                        }}
                        title={
                          cannotAddCover
                            ? 'Você já escolheu três capas. Remova uma para escolher outra.'
                            : isCoverSelected
                              ? `Remover capa ${String(selectedCoverPosition)} da lista`
                              : 'Usar como capa da lista'
                        }
                        type="button"
                      >
                        <Image aria-hidden="true" size={16} />
                        {isCoverSelected ? (
                          <span
                            aria-hidden="true"
                            className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white ring-1 ring-bg-primary"
                          >
                            {String(selectedCoverPosition)}
                          </span>
                        ) : null}
                      </button>
                    );
                  const removeButton = (
                    <button
                      aria-label={`Remover ${game.name} da lista`}
                      className={
                        gamesView === 'grid'
                          ? 'absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-lg bg-black/65 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-white'
                          : 'flex size-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-red-500/15 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand'
                      }
                      disabled={busyGameId !== null || saving || isReordering}
                      onClick={() => {
                        void removeGame(game);
                      }}
                      type="button"
                    >
                      {busyGameId === game.igdbId ? (
                        <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
                      ) : (
                        <X aria-hidden="true" size={gamesView === 'grid' ? 15 : 17} />
                      )}
                    </button>
                  );
                  const itemClassName =
                    gamesView === 'grid'
                      ? `relative flex w-full min-w-0 flex-col overflow-hidden rounded-md transition-transform duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedGameId === game.igdbId ? 'scale-[0.98] opacity-40' : ''} ${isDropTarget ? 'scale-[1.03] ring-2 ring-brand' : ''} ${swappedGameIds.has(game.igdbId) ? 'scale-[1.02] ring-2 ring-brand/70' : ''}`
                      : `grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-hover/70 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)_auto] ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedGameId === game.igdbId ? 'opacity-50' : ''} ${isDropTarget ? 'bg-brand/10 ring-1 ring-inset ring-brand' : ''} ${swappedGameIds.has(game.igdbId) ? 'bg-brand/15 ring-1 ring-inset ring-brand/70' : ''}`;

                  return (
                    <li className={itemClassName} key={game.igdbId}>
                      <div
                        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                        aria-label={`Jogo ${game.name}, posição ${String(position + 1)} de ${String(games.length)}. Use Alt e as setas para trocar com um jogo adjacente.`}
                        className={
                          gamesView === 'grid'
                            ? 'flex min-w-0 flex-1 flex-col outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
                            : 'col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
                        }
                        draggable={canReorder}
                        onDragEnd={() => {
                          setDraggedGameId(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(event) => {
                          handleGameDragOver(event, game.igdbId);
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', String(game.igdbId));
                          setDraggedGameId(game.igdbId);
                          setErrorMessage(null);
                        }}
                        onDrop={(event) => {
                          handleGameDrop(event, game.igdbId);
                        }}
                        onKeyDown={(event) => {
                          handleReorderKeyDown(event, game.igdbId);
                        }}
                        role="button"
                        tabIndex={canReorder ? 0 : undefined}
                      >
                        {gamesView === 'grid' ? (
                          <>
                            <div className="aspect-video w-full overflow-hidden bg-surface-raised">
                              {game.coverUrl === null ? (
                                <span className="flex size-full items-center justify-center text-text-muted">
                                  <Gamepad2 aria-hidden="true" size={32} />
                                </span>
                              ) : (
                                <img
                                  alt={`Capa de ${game.name}`}
                                  className="size-full object-cover"
                                  draggable={false}
                                  loading="lazy"
                                  src={game.coverUrl}
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 px-3 py-2.5">
                              <span className="line-clamp-2 min-h-10 text-left text-sm font-semibold leading-5 text-content-primary">
                                {game.name}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex min-w-0 items-center gap-3">
                              {game.coverUrl === null ? (
                                <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md bg-surface-raised text-text-muted">
                                  <Gamepad2 aria-hidden="true" size={17} />
                                </span>
                              ) : (
                                <img
                                  alt={`Capa de ${game.name}`}
                                  className="h-12 w-9 shrink-0 rounded-md object-cover"
                                  draggable={false}
                                  loading="lazy"
                                  src={game.coverUrl}
                                />
                              )}
                              <span className="truncate text-sm font-medium text-content-primary">
                                {game.name}
                              </span>
                            </div>
                            <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-text-muted sm:inline-flex">
                              <CalendarDays aria-hidden="true" size={14} />
                              {formatReleaseDate(game.releaseDate)}
                            </span>
                          </>
                        )}
                      </div>
                      {gamesView === 'grid' ? (
                        <>
                          {coverButton}
                          {removeButton}
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          {coverButton}
                          {removeButton}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {errorMessage === null ? null : (
            <p className="mt-3 text-sm text-red-200" role="alert">
              {errorMessage}
            </p>
          )}
          <p aria-live="polite" className="sr-only" role="status">
            {reorderAnnouncement}
          </p>
        </section>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function ListDetailsModal(props: ListDetailsModalProps) {
  return <ListDetailsDialog {...props} />;
}
