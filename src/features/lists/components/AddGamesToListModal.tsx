import { Check, Gamepad2, GripVertical, LoaderCircle, Plus, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { searchGames } from '@/features/games/api/game-search-client';
import { isListsOperationCancelled } from '@/features/lists/context/ListsProvider';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';
import type { GameSnapshot, UserListSummary } from '@/features/lists/model/lists';
import type { DragEvent, KeyboardEvent, ReactElement } from 'react';

interface AddGamesToListModalProps {
  readonly list: UserListSummary;
  readonly onClose: () => void;
  readonly onSave: (games: readonly GameSnapshot[]) => Promise<void>;
}

type SearchState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly games: readonly GameSearchResult[] }
  | { readonly status: 'error' };

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;
const saveErrorMessage = 'Não foi possível adicionar todos os jogos. Tente novamente.';

function reorderGames(
  games: readonly GameSearchResult[],
  draggedId: number,
  targetId: number,
): readonly GameSearchResult[] {
  const draggedIndex = games.findIndex((game) => game.id === draggedId);
  const targetIndex = games.findIndex((game) => game.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return games;

  const nextGames = [...games];
  const [draggedGame] = nextGames.splice(draggedIndex, 1);
  nextGames.splice(targetIndex, 0, draggedGame);
  return nextGames;
}

function formatReleaseDate(value: string | null): string {
  if (value === null) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function platformSummary(platforms: readonly string[]): string {
  if (platforms.length === 0) return 'Plataformas não informadas';
  return platforms.slice(0, 2).join(' · ');
}

function gameSnapshot(game: GameSearchResult): GameSnapshot | null {
  if (game.releaseDate === null) return null;
  return {
    coverUrl: game.coverUrl,
    igdbId: game.id,
    name: game.name,
    releaseDate: game.releaseDate,
  };
}

function AddGamesToListDialog({ list, onClose, onSave }: AddGamesToListModalProps): ReactElement {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [selectedGames, setSelectedGames] = useState<readonly GameSearchResult[]>([]);
  const [draggedGameId, setDraggedGameId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < MIN_SEARCH_LENGTH) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void searchGames(normalizedQuery, { signal: controller.signal })
        .then((games) => {
          if (!controller.signal.aborted) setSearchState({ status: 'success', games });
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchState({ status: 'error' });
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusTo =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    searchInputRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!submittingRef.current) onClose();
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

  const close = () => {
    if (!submittingRef.current) onClose();
  };

  const selectGame = (game: GameSearchResult) => {
    if (game.releaseDate === null || submittingRef.current) return;
    setSubmissionError(null);
    setSelectedGames((current) =>
      current.some((selectedGame) => selectedGame.id === game.id) ? current : [...current, game],
    );
  };

  const removeGame = (gameId: number) => {
    if (submittingRef.current) return;
    setSubmissionError(null);
    setSelectedGames((current) => current.filter((game) => game.id !== gameId));
  };

  const moveSelectedGame = (gameId: number, offset: -1 | 1) => {
    setSelectedGames((current) => {
      const index = current.findIndex((game) => game.id === gameId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      return reorderGames(current, gameId, current[target]?.id ?? gameId);
    });
  };

  const handleDrop = (event: DragEvent<HTMLLIElement>, targetId: number) => {
    event.preventDefault();
    if (draggedGameId !== null) {
      setSelectedGames((current) => reorderGames(current, draggedGameId, targetId));
    }
    setDraggedGameId(null);
  };

  const handleReorderKeyDown = (event: KeyboardEvent<HTMLButtonElement>, gameId: number) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelectedGame(gameId, event.key === 'ArrowUp' ? -1 : 1);
    }
  };

  const save = async () => {
    if (submittingRef.current || selectedGames.length === 0) return;
    const snapshots = selectedGames
      .map(gameSnapshot)
      .filter((snapshot): snapshot is GameSnapshot => snapshot !== null);
    if (snapshots.length !== selectedGames.length) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmissionError(null);
    try {
      await onSave(snapshots);
      onClose();
    } catch (error: unknown) {
      if (!isListsOperationCancelled(error)) setSubmissionError(saveErrorMessage);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const searchContent =
    searchState.status === 'idle' ? (
      query.trim().length < MIN_SEARCH_LENGTH ? (
        <p className="px-4 py-3 text-sm text-text-muted">
          Digite ao menos 2 caracteres para buscar.
        </p>
      ) : null
    ) : searchState.status === 'loading' ? (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-muted" role="status">
        <LoaderCircle aria-hidden="true" className="animate-spin text-brand" size={16} />
        Buscando jogos…
      </div>
    ) : searchState.status === 'error' ? (
      <p className="px-4 py-3 text-sm text-brand-bright" role="alert">
        Não foi possível buscar jogos. Tente novamente.
      </p>
    ) : searchState.games.length === 0 ? (
      <p className="px-4 py-3 text-sm text-text-muted">Nenhum jogo encontrado.</p>
    ) : (
      <ul aria-label="Resultados da busca" className="max-h-72 overflow-y-auto p-1.5">
        {searchState.games.map((game) => {
          const isSelected = selectedGames.some((selectedGame) => selectedGame.id === game.id);
          const hasReleaseDate = game.releaseDate !== null;

          return (
            <li key={game.id}>
              <button
                aria-pressed={isSelected}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || isSelected || !hasReleaseDate}
                onClick={() => {
                  selectGame(game);
                }}
                type="button"
              >
                {game.coverUrl === null ? (
                  <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-surface-raised text-text-muted">
                    <Gamepad2 aria-hidden="true" size={18} />
                  </span>
                ) : (
                  <img
                    alt={`Capa de ${game.name}`}
                    className="h-14 w-10 shrink-0 rounded-md object-cover"
                    loading="lazy"
                    src={game.coverUrl}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-content-primary">
                    {game.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-text-muted">
                    {platformSummary(game.platforms)} · {formatReleaseDate(game.releaseDate)}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-bright">
                  {isSelected ? (
                    <>
                      <Check aria-hidden="true" size={15} /> Adicionado
                    </>
                  ) : hasReleaseDate ? (
                    <>
                      <Plus aria-hidden="true" size={15} /> Adicionar
                    </>
                  ) : (
                    'Sem data'
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );

  const modal = (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 py-4 sm:px-6 sm:py-8">
      <button
        aria-label="Fechar ao clicar fora do modal"
        className="absolute inset-0 size-full bg-black/75 disabled:cursor-not-allowed"
        disabled={submitting}
        onClick={close}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-busy={submitting || undefined}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-10 my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[1052px] flex-col overflow-hidden rounded-2xl border border-border-brand bg-surface shadow-[0_14px_36px_#00000077] sm:max-h-[calc(100dvh-4rem)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-6">
          <div>
            <h2 className="font-heading text-xl font-semibold text-content-primary" id={titleId}>
              Adicionar jogos
            </h2>
            <p className="mt-1 text-sm text-text-muted" id={descriptionId}>
              Busque e selecione jogos para adicionar à lista “{list.name}”.
            </p>
          </div>
          <button
            aria-label="Fechar modal"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-text-muted transition-colors enabled:hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            disabled={submitting}
            onClick={close}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:gap-6 sm:px-7 sm:py-6">
          <div className="space-y-2">
            <label className="sr-only" htmlFor="game-search-input">
              Buscar jogos por nome
            </label>
            <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border-brand bg-bg-secondary px-4 focus-within:border-brand/70">
              <Search aria-hidden="true" className="shrink-0 text-text-muted" size={18} />
              <input
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-text-muted"
                id="game-search-input"
                onChange={(event) => {
                  const nextQuery = event.currentTarget.value;
                  setQuery(nextQuery);
                  setSearchState(
                    nextQuery.trim().length >= MIN_SEARCH_LENGTH
                      ? { status: 'loading' }
                      : { status: 'idle' },
                  );
                }}
                placeholder="Buscar jogo pelo nome…"
                ref={searchInputRef}
                type="search"
                value={query}
              />
            </div>
            {searchState.status === 'idle' && query.trim().length < MIN_SEARCH_LENGTH ? null : (
              <div className="overflow-hidden rounded-xl border border-border-brand bg-bg-secondary">
                {searchContent}
              </div>
            )}
          </div>

          <section aria-labelledby="selected-games-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3
                  className="font-heading text-lg font-medium text-content-primary"
                  id="selected-games-heading"
                >
                  Jogos adicionados
                </h3>
                <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand-bright">
                  {selectedGames.length} {selectedGames.length === 1 ? 'jogo' : 'jogos'}
                </span>
              </div>
              {selectedGames.length > 1 ? (
                <span className="text-xs text-text-muted">Arraste para reordenar</span>
              ) : null}
            </div>

            {selectedGames.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 px-4 py-5 text-center text-sm text-text-muted">
                Os jogos selecionados aparecerão aqui.
              </p>
            ) : (
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {selectedGames.map((game) => (
                  <li
                    className={`flex min-w-0 items-center gap-2 rounded-xl border border-border-brand bg-bg-secondary p-2.5 ${draggedGameId === game.id ? 'opacity-50' : ''}`}
                    key={game.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      handleDrop(event, game.id);
                    }}
                  >
                    <button
                      aria-label={`Reordenar ${game.name}; use as setas para mover`}
                      className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-text-muted focus-visible:outline-2 focus-visible:outline-brand active:cursor-grabbing"
                      draggable={!submitting}
                      onDragEnd={() => {
                        setDraggedGameId(null);
                      }}
                      onDragStart={(event) => {
                        setDraggedGameId(game.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(game.id));
                      }}
                      onKeyDown={(event) => {
                        handleReorderKeyDown(event, game.id);
                      }}
                      type="button"
                    >
                      <GripVertical aria-hidden="true" size={16} />
                    </button>
                    {game.coverUrl === null ? (
                      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-surface-raised text-text-muted">
                        <Gamepad2 aria-hidden="true" size={18} />
                      </span>
                    ) : (
                      <img
                        alt=""
                        className="h-14 w-10 shrink-0 rounded-md object-cover"
                        loading="lazy"
                        src={game.coverUrl}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-content-primary">
                        {game.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-text-muted">
                        {platformSummary(game.platforms)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-text-muted">
                        {formatReleaseDate(game.releaseDate)}
                      </span>
                    </span>
                    <button
                      aria-label={`Remover ${game.name}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-bright transition-colors enabled:hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand"
                      disabled={submitting}
                      onClick={() => {
                        removeGame(game.id);
                      }}
                      type="button"
                    >
                      <X aria-hidden="true" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {submissionError === null ? null : (
            <p className="text-sm text-brand-bright" role="alert">
              {submissionError}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2.5 border-t border-white/5 px-5 py-4 sm:px-7">
          <button
            className="min-h-11 rounded-xl border border-border-brand bg-bg-secondary px-4 text-sm font-semibold text-content-primary transition-colors enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            disabled={submitting}
            onClick={close}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition-colors enabled:hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            disabled={submitting || selectedGames.length === 0}
            onClick={() => void save()}
            type="button"
          >
            {submitting ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
                Salvando…
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function AddGamesToListModal(props: AddGamesToListModalProps): ReactElement {
  return <AddGamesToListDialog {...props} />;
}
