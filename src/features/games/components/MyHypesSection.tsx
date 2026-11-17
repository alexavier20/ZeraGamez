import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  LoaderCircle,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { searchGames } from '@/features/games/api/game-search-client';
import {
  createSupabaseUserHypesRepository,
  type UserHypeGame,
} from '@/features/games/api/user-hypes-repository';
import { getReleaseCountdown } from '@/features/games/model/release-countdown';
import { todayInSaoPaulo } from '@/features/releases/model/release-calendar';
import { formatReleaseDate } from '@/features/releases/model/release-presentation';
import { GameRowsLoading, HypeCardsLoading } from '@/shared/components/LoadingSkeletons';
import { getSupabaseClient } from '@/shared/supabase/client';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';

type SearchState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'success'; readonly games: readonly GameSearchResult[] };

type CollectionStatus = 'loading' | 'ready' | 'error';

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;
const HYPES_PER_PAGE = 12;

function compareReleaseDates(left: UserHypeGame, right: UserHypeGame) {
  if (left.releaseDate === null) return right.releaseDate === null ? 0 : 1;
  if (right.releaseDate === null) return -1;
  return left.releaseDate.localeCompare(right.releaseDate);
}

function HypeCountdown({
  releaseDate,
  now,
}: Readonly<{ releaseDate: string | null; now: number }>) {
  if (releaseDate === null) {
    return (
      <p className="mt-3 text-[11px] leading-4 font-medium text-text-muted">
        Data de lançamento não divulgada
      </p>
    );
  }

  const countdown = getReleaseCountdown(releaseDate, now);
  const today = todayInSaoPaulo(new Date(now));
  const isReleased = releaseDate < today;
  if (isReleased) {
    return (
      <span className="mt-3 inline-flex w-fit rounded-md bg-brand-bright px-2 py-1 text-xs leading-4 font-semibold text-brand-ink">
        Já lançado
      </span>
    );
  }

  const labels = [
    { label: 'Dias', value: countdown.days },
    { label: 'Horas', value: countdown.hours },
    { label: 'Minutos', value: countdown.minutes },
  ];

  return (
    <div className="mt-3">
      {releaseDate === today ? (
        <p className="text-[11px] leading-4 font-medium text-brand-bright">Lançamento hoje</p>
      ) : null}
      <dl aria-label="Tempo até o lançamento" className="mt-2 grid grid-cols-3 gap-2">
        {labels.map(({ label, value }) => (
          <div
            className={`min-h-12 rounded-lg border ${releaseDate === today ? 'border-brand' : 'border-border'} bg-bg-secondary px-1.5 py-1 text-center`}
            key={label}
          >
            <dd className="font-heading text-base leading-5 font-semibold tabular-nums text-content-primary">
              {String(value).padStart(2, '0')}
            </dd>
            <dt className="text-[11px] leading-4 text-text-muted">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface AddHypeModalProps {
  readonly actionError: string | null;
  readonly games: readonly UserHypeGame[];
  readonly onAdd: (game: GameSearchResult) => Promise<void>;
  readonly onClose: () => void;
  readonly savingGameId: number | null;
}

const focusableSelector =
  'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function AddHypeModal({ actionError, games, onAdd, onClose, savingGameId }: AddHypeModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(savingGameId !== null);
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });

  useLayoutEffect(() => {
    savingRef.current = savingGameId !== null;
  }, [savingGameId]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < MIN_SEARCH_LENGTH) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void searchGames(normalizedQuery, { signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) setSearchState({ status: 'success', games: results });
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchState({ status: 'error' });
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
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
        if (!savingRef.current) onClose();
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
    if (!savingRef.current) onClose();
  };
  const queryIsLongEnough = query.trim().length >= MIN_SEARCH_LENGTH;
  const searchContent =
    searchState.status === 'loading' ? (
      <GameRowsLoading />
    ) : searchState.status === 'error' ? (
      <p className="px-4 py-3 text-sm text-red-700" role="alert">
        Não foi possível buscar jogos. Tente novamente.
      </p>
    ) : searchState.status === 'success' && searchState.games.length === 0 ? (
      <p className="px-4 py-3 text-sm text-text-muted">Nenhum jogo encontrado.</p>
    ) : searchState.status === 'success' ? (
      <ul aria-label="Resultados da busca" className="max-h-72 overflow-y-auto p-1.5">
        {searchState.games.map((game) => {
          const isAdded = games.some((savedGame) => savedGame.igdbId === game.id);
          const isSaving = savingGameId === game.id;
          return (
            <li key={game.id}>
              <button
                aria-pressed={isAdded}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors enabled:hover:bg-brand-bright/30 enabled:hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAdded || savingGameId !== null}
                onClick={() => void onAdd(game)}
                type="button"
              >
                {game.coverUrl === null ? (
                  <span
                    aria-hidden="true"
                    className="grid size-12 shrink-0 place-items-center rounded-md bg-bg-secondary text-text-muted"
                  >
                    <Gamepad2 size={18} strokeWidth={1.5} />
                  </span>
                ) : (
                  <img
                    alt=""
                    className="size-12 shrink-0 rounded-md object-cover"
                    loading="lazy"
                    src={game.coverUrl}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-content-primary">
                    {game.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-text-muted">
                    {game.releaseDate === null
                      ? 'Data não divulgada'
                      : formatReleaseDate(game.releaseDate)}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-content-primary">
                  {isSaving ? (
                    <>
                      <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
                      Adicionando…
                    </>
                  ) : isAdded ? (
                    <>
                      <Check aria-hidden="true" size={18} strokeWidth={1.5} /> Adicionado
                    </>
                  ) : (
                    <>
                      <Plus aria-hidden="true" size={18} strokeWidth={1.5} /> Adicionar
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    ) : queryIsLongEnough ? (
      <p className="px-4 py-3 text-sm text-text-muted">Preparando a busca…</p>
    ) : null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto px-3 py-4 sm:px-6">
      <button
        aria-label="Fechar busca de hype"
        className="absolute inset-0 size-full bg-black/75 disabled:cursor-not-allowed"
        disabled={savingGameId !== null}
        onClick={close}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        aria-busy={savingGameId !== null || undefined}
        className="modal-lower-right-cut relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col overflow-hidden border-l-4 border-l-brand-bright bg-modal shadow-[0_14px_36px_#00000080]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2
              className="font-heading text-xl font-bold text-content-primary sm:text-2xl"
              id={titleId}
            >
              Adicionar hype
            </h2>
            <p className="mt-1 text-sm text-text-muted" id={descriptionId}>
              Busque um jogo para acompanhar o lançamento.
            </p>
          </div>
          <button
            aria-label="Fechar busca de hype"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-text-muted transition-colors hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand-bright"
            disabled={savingGameId !== null}
            onClick={close}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="space-y-2">
            <label className="sr-only" htmlFor="my-hypes-search">
              Buscar jogos para adicionar aos Meus Hypes
            </label>
            <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-bg-secondary px-4 focus-within:border-brand/70">
              <Search
                aria-hidden="true"
                className="shrink-0 text-text-muted"
                size={18}
                strokeWidth={1.5}
              />
              <input
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-text-muted"
                id="my-hypes-search"
                onChange={(event) => {
                  const nextQuery = event.currentTarget.value;
                  setQuery(nextQuery);
                  setSearchState(
                    nextQuery.trim().length >= MIN_SEARCH_LENGTH
                      ? { status: 'loading' }
                      : { status: 'idle' },
                  );
                }}
                placeholder="Buscar jogos"
                ref={searchInputRef}
                type="search"
                value={query}
              />
            </div>
            {queryIsLongEnough ? (
              <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
                {searchContent}
              </div>
            ) : (
              <p className="px-1 py-2 text-xs text-text-muted">
                Digite pelo menos duas letras para pesquisar.
              </p>
            )}
          </div>

          {actionError === null ? null : (
            <p
              className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700"
              role="alert"
            >
              {actionError}
            </p>
          )}

          {savingGameId === null ? null : (
            <p aria-live="polite" className="sr-only" role="status">
              Adicionando jogo aos Meus Hypes…
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4 sm:px-7">
          <button
            className="min-h-11 rounded-xl border border-border px-5 text-sm font-bold text-content-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingGameId !== null}
            onClick={close}
            type="button"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AuthenticatedMyHypesSection({ userId }: Readonly<{ userId: string }>) {
  const client = useMemo(() => getSupabaseClient(), []);
  const repository = useMemo(
    () => (client === null ? null : createSupabaseUserHypesRepository(client)),
    [client],
  );
  const [games, setGames] = useState<readonly UserHypeGame[]>([]);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus>('loading');
  const [page, setPage] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [savingGameId, setSavingGameId] = useState<number | null>(null);
  const [removingGameId, setRemovingGameId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const openAddModal = useCallback(() => {
    setAddError(null);
    setRemoveError(null);
    setIsAddModalOpen(true);
  }, []);
  const closeAddModal = useCallback(() => {
    setAddError(null);
    setIsAddModalOpen(false);
  }, []);

  useEffect(() => {
    if (repository === null) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setCollectionStatus('loading');
    });

    void repository
      .list(userId)
      .then((savedGames) => {
        if (!active) return;
        setGames(savedGames);
        setCollectionStatus('ready');
      })
      .catch(() => {
        if (active) setCollectionStatus('error');
      });

    return () => {
      active = false;
    };
  }, [repository, retryKey, userId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const addGame = async (game: GameSearchResult) => {
    if (repository === null || savingGameId !== null || removingGameId !== null) return;

    setSavingGameId(game.id);
    setAddError(null);
    try {
      await repository.add(userId, game);
      const savedGame: UserHypeGame = {
        coverUrl: game.coverUrl,
        igdbId: game.id,
        name: game.name,
        releaseDate: game.releaseDate,
      };
      setGames((current) => [...current, savedGame].sort(compareReleaseDates));
    } catch {
      setAddError('Não foi possível adicionar o jogo. Tente novamente.');
    } finally {
      setSavingGameId(null);
    }
  };

  const removeGame = async (game: UserHypeGame) => {
    if (repository === null || removingGameId !== null || savingGameId !== null) return;

    setRemovingGameId(game.igdbId);
    setRemoveError(null);
    try {
      await repository.remove(userId, game.igdbId);
      const remainingGames = games.filter((savedGame) => savedGame.igdbId !== game.igdbId);
      setGames(remainingGames);
      setPage((currentPage) =>
        Math.min(currentPage, Math.max(0, Math.ceil(remainingGames.length / HYPES_PER_PAGE) - 1)),
      );
    } catch {
      setRemoveError('Não foi possível remover o jogo. Tente novamente.');
    } finally {
      setRemovingGameId(null);
    }
  };

  if (repository === null) {
    return (
      <p className="mt-4 text-sm text-text-muted" role="alert">
        O serviço de listas não está disponível.
      </p>
    );
  }

  const pageCount = Math.ceil(games.length / HYPES_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleGames = games.slice(
    currentPage * HYPES_PER_PAGE,
    (currentPage + 1) * HYPES_PER_PAGE,
  );

  return (
    <div className="mt-5 space-y-5">
      <div className="flex h-11 justify-end">
        <button
          aria-expanded={isAddModalOpen}
          aria-haspopup="dialog"
          className="group inline-flex min-h-11 items-center gap-2 cut-corner-button cut-corner-button-outline px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors duration-300 ease-out before:transition-colors before:duration-300 before:ease-out enabled:hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright sm:absolute sm:top-8 sm:right-0 sm:z-10"
          disabled={
            collectionStatus !== 'ready' || savingGameId !== null || removingGameId !== null
          }
          onClick={openAddModal}
          type="button"
        >
          <Plus
            aria-hidden="true"
            className="text-brand transition-colors duration-300 ease-out group-hover:text-brand-ink"
            size={18}
            strokeWidth={1.5}
          />
          <span>Novo hype</span>
        </button>
      </div>

      {removeError === null ? null : (
        <p className="text-sm text-red-700" role="alert">
          {removeError}
        </p>
      )}

      {collectionStatus === 'loading' ? (
        <HypeCardsLoading />
      ) : collectionStatus === 'error' ? (
        <div
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-5 text-center"
          role="alert"
        >
          <p className="text-sm text-red-700">Não foi possível carregar seus jogos hypados.</p>
          <button
            className="mt-3 min-h-11 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-semibold text-red-700"
            onClick={() => {
              setRetryKey((value) => value + 1);
            }}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {games.length === 0 ? (
            <p className="text-sm text-text-muted" role="status">
              Sua lista está vazia. Adicione um hype para acompanhar os próximos lançamentos.
            </p>
          ) : null}
          <ul
            aria-label="Meus jogos hypados"
            className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 min-[900px]:grid-cols-3 lg:grid-cols-4"
          >
            {visibleGames.map((game) => (
              <li className="mx-auto h-full w-full max-w-[320px]" key={game.igdbId}>
                <article className="group isolate relative flex h-full min-h-[164px] min-w-0 overflow-hidden border border-border bg-surface transition-colors duration-150 hover:border-border">
                  {game.coverUrl === null ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 grid place-items-center text-brand-bright/20"
                    >
                      <Gamepad2 size={64} />
                    </span>
                  ) : (
                    <img
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 size-full object-cover"
                      loading="lazy"
                      src={game.coverUrl}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/35"
                  />
                  <Link
                    className="relative z-10 flex min-w-0 flex-1 flex-col p-3 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-bright"
                    to={`/jogos/${String(game.igdbId)}`}
                  >
                    <span className="block min-w-0 pr-12">
                      <span className="block line-clamp-2 text-sm font-semibold leading-tight text-white">
                        {game.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-white/85">
                        {game.releaseDate === null
                          ? 'Data não divulgada'
                          : formatReleaseDate(game.releaseDate)}
                      </span>
                    </span>
                    <span className="mt-auto block">
                      <HypeCountdown now={now} releaseDate={game.releaseDate} />
                    </span>
                  </Link>
                  <button
                    aria-label={`Remover ${game.name} dos Meus Hypes`}
                    className="absolute right-2 top-2 z-20 flex size-11 items-center justify-center rounded-lg text-white transition-colors duration-150 hover:text-brand-bright disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
                    disabled={removingGameId !== null || savingGameId !== null}
                    onClick={() => void removeGame(game)}
                    type="button"
                  >
                    {removingGameId === game.igdbId ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="animate-spin drop-shadow-[0_1px_2px_rgba(43,43,48,0.9)]"
                        size={24}
                        strokeWidth={1.5}
                      />
                    ) : (
                      <X
                        aria-hidden="true"
                        className="drop-shadow-[0_1px_2px_rgba(43,43,48,0.9)]"
                        size={24}
                        strokeWidth={2}
                      />
                    )}
                  </button>
                </article>
              </li>
            ))}
            <li className="mx-auto h-full w-full max-w-[320px]">
              <button
                aria-haspopup="dialog"
                aria-label="Novo hype"
                className="group flex min-h-[164px] w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-transparent text-text-muted transition-colors duration-150 enabled:hover:border-brand enabled:hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
                disabled={savingGameId !== null || removingGameId !== null}
                onClick={openAddModal}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="grid size-16 place-items-center rounded-full bg-surface transition-colors duration-150 group-enabled:hover:bg-surface-hover"
                >
                  <Plus className="text-brand" size={32} strokeWidth={1.8} />
                </span>
                <span className="text-sm font-medium">Novo hype</span>
              </button>
            </li>
          </ul>
          {pageCount > 1 ? (
            <nav
              aria-label="Paginação dos Meus Hypes"
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <button
                aria-label="Página anterior"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-content-primary transition-colors enabled:hover:border-border enabled:hover:bg-brand-bright/30 enabled:hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
                disabled={currentPage === 0}
                onClick={() => {
                  setPage((value) => Math.max(0, value - 1));
                }}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
                Anterior
              </button>
              <span aria-live="polite" className="text-xs tabular-nums text-text-muted sm:text-sm">
                Página {String(currentPage + 1)} de {String(pageCount)}
              </span>
              <button
                aria-label="Próxima página"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-content-primary transition-colors enabled:hover:border-border enabled:hover:bg-brand-bright/30 enabled:hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
                disabled={currentPage >= pageCount - 1}
                onClick={() => {
                  setPage((value) => Math.min(pageCount - 1, value + 1));
                }}
                type="button"
              >
                Próxima
                <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
              </button>
            </nav>
          ) : null}
        </>
      )}
      {isAddModalOpen ? (
        <AddHypeModal
          actionError={addError}
          games={games}
          onAdd={addGame}
          onClose={closeAddModal}
          savingGameId={savingGameId}
        />
      ) : null}
    </div>
  );
}

export function MyHypesSection() {
  const { state } = useAuth();

  return (
    <section
      aria-labelledby="my-hypes-title"
      className="relative mt-12 border-t border-border pt-8"
    >
      <div>
        <h2
          className="mt-1 flex items-center gap-2 font-heading text-xl font-semibold text-content-primary sm:text-2xl"
          id="my-hypes-title"
        >
          <span
            aria-hidden="true"
            className="h-6 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-brand"
          />
          Meus Hypes
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Monte sua lista pessoal e acompanhe a contagem regressiva de cada jogo.
        </p>
      </div>

      {state.status === 'loading' ? (
        <div className="mt-5">
          <HypeCardsLoading />
        </div>
      ) : state.status === 'anonymous' ? (
        <p className="mt-5 rounded-xl border border-dashed border-border px-5 py-6 text-center text-sm text-text-muted">
          <Link
            className="font-semibold text-brand-bright underline underline-offset-4"
            to="/entrar"
          >
            Entre na sua conta
          </Link>{' '}
          para criar uma lista pessoal de jogos hypados.
        </p>
      ) : state.status === 'unavailable' ? (
        <p className="mt-5 text-sm text-text-muted" role="alert">
          Não foi possível verificar sua conta agora.
        </p>
      ) : (
        <AuthenticatedMyHypesSection userId={state.user.id} />
      )}
    </section>
  );
}
