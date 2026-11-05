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
import { useEffect, useMemo, useState } from 'react';
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
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
        Data de lançamento não divulgada
      </p>
    );
  }

  const countdown = getReleaseCountdown(releaseDate, now);
  const today = todayInSaoPaulo(new Date(now));
  const isReleased = releaseDate < today;
  if (isReleased) {
    return (
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-bright">
        Já lançado
      </p>
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
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-green-400 motion-safe:animate-pulse">
          Lançamento hoje
        </p>
      ) : null}
      <dl aria-label="Tempo até o lançamento" className="mt-1.5 grid grid-cols-3 gap-1.5">
        {labels.map(({ label, value }) => (
          <div
            className={`rounded-lg border ${releaseDate === today ? 'border-green-400/60' : 'border-[#aaa69e]/30'} bg-black/75 px-1.5 py-1 text-center shadow-[0_0_14px_#00000060] backdrop-blur-sm`}
            key={label}
          >
            <dd className="font-heading text-base font-semibold tabular-nums text-content-primary">
              {String(value).padStart(2, '0')}
            </dd>
            <dt className="text-[9px] uppercase tracking-wide text-text-muted">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
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
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [savingGameId, setSavingGameId] = useState<number | null>(null);
  const [removingGameId, setRemovingGameId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (repository === null) return;

    let active = true;
    setCollectionStatus('loading');

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

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < MIN_SEARCH_LENGTH) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void searchGames(normalizedQuery, { signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) {
            setSearchState({ status: 'success', games: results });
          }
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

  const addGame = async (game: GameSearchResult) => {
    if (repository === null || savingGameId !== null || removingGameId !== null) return;

    setSavingGameId(game.id);
    setActionError(null);
    try {
      await repository.add(userId, game);
      const savedGame: UserHypeGame = {
        coverUrl: game.coverUrl,
        igdbId: game.id,
        name: game.name,
        releaseDate: game.releaseDate,
      };
      setGames((current) => [...current, savedGame].sort(compareReleaseDates));
      setQuery('');
      setSearchState({ status: 'idle' });
    } catch {
      setActionError('Não foi possível adicionar o jogo. Tente novamente.');
    } finally {
      setSavingGameId(null);
    }
  };

  const removeGame = async (game: UserHypeGame) => {
    if (repository === null || removingGameId !== null || savingGameId !== null) return;

    setRemovingGameId(game.igdbId);
    setActionError(null);
    try {
      await repository.remove(userId, game.igdbId);
      const remainingGames = games.filter((savedGame) => savedGame.igdbId !== game.igdbId);
      setGames(remainingGames);
      setPage((currentPage) =>
        Math.min(currentPage, Math.max(0, Math.ceil(remainingGames.length / HYPES_PER_PAGE) - 1)),
      );
    } catch {
      setActionError('Não foi possível remover o jogo. Tente novamente.');
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

  const queryIsLongEnough = query.trim().length >= MIN_SEARCH_LENGTH;
  const pageCount = Math.ceil(games.length / HYPES_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleGames = games.slice(
    currentPage * HYPES_PER_PAGE,
    (currentPage + 1) * HYPES_PER_PAGE,
  );
  const searchContent =
    searchState.status === 'loading' ? (
      <GameRowsLoading />
    ) : searchState.status === 'error' ? (
      <p className="px-4 py-3 text-sm text-brand-bright" role="alert">
        Não foi possível buscar jogos. Tente novamente.
      </p>
    ) : searchState.status === 'success' && searchState.games.length === 0 ? (
      <p className="px-4 py-3 text-sm text-text-muted">Nenhum jogo encontrado.</p>
    ) : searchState.status === 'success' ? (
      <ul aria-label="Resultados da busca" className="max-h-72 overflow-y-auto p-1.5">
        {searchState.games.map((game) => {
          const isAdded = games.some((savedGame) => savedGame.igdbId === game.id);
          return (
            <li key={game.id}>
              <button
                aria-pressed={isAdded}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAdded || savingGameId !== null}
                onClick={() => void addGame(game)}
                type="button"
              >
                {game.coverUrl === null ? (
                  <span
                    aria-hidden="true"
                    className="grid size-12 shrink-0 place-items-center rounded-md bg-surface-raised text-text-muted"
                  >
                    <Gamepad2 size={18} />
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
                  <span className="block truncate text-sm font-semibold text-content-primary">
                    {game.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-text-muted">
                    {game.releaseDate === null
                      ? 'Data não divulgada'
                      : formatReleaseDate(game.releaseDate)}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-bright">
                  {isAdded ? (
                    <>
                      <Check aria-hidden="true" size={15} /> Adicionado
                    </>
                  ) : (
                    <>
                      <Plus aria-hidden="true" size={15} /> Adicionar
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

  return (
    <div className="mt-5 space-y-5">
      <div className="space-y-2">
        <label className="sr-only" htmlFor="my-hypes-search">
          Buscar jogos para adicionar aos Meus Hypes
        </label>
        <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border-brand bg-bg-secondary px-4 focus-within:border-brand/70">
          <Search aria-hidden="true" className="shrink-0 text-text-muted" size={18} />
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
            placeholder="Busque um jogo pelo nome…"
            type="search"
            value={query}
          />
        </div>
        {queryIsLongEnough ? (
          <div className="overflow-hidden rounded-xl border border-border-brand bg-bg-secondary">
            {searchContent}
          </div>
        ) : null}
      </div>

      {actionError === null ? null : (
        <p className="text-sm text-brand-bright" role="alert">
          {actionError}
        </p>
      )}

      {collectionStatus === 'loading' ? (
        <HypeCardsLoading />
      ) : collectionStatus === 'error' ? (
        <div
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-5 text-center"
          role="alert"
        >
          <p className="text-sm text-red-100">Não foi possível carregar seus jogos hypados.</p>
          <button
            className="mt-3 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-bold text-white"
            onClick={() => {
              setRetryKey((value) => value + 1);
            }}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : games.length === 0 ? (
        <p
          className="rounded-xl border border-dashed border-white/15 px-5 py-7 text-center text-sm text-text-muted"
          role="status"
        >
          Sua lista está vazia. Busque um jogo para acompanhar o lançamento.
        </p>
      ) : (
        <>
          <ul
            aria-label="Meus jogos hypados"
            className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 min-[900px]:grid-cols-3 lg:grid-cols-4"
          >
            {visibleGames.map((game) => (
              <li className="mx-auto h-full w-full max-w-[320px]" key={game.igdbId}>
                <article className="group isolate relative flex h-full min-h-[164px] min-w-0 overflow-hidden rounded-xl border border-white/10 bg-surface shadow-[0_8px_22px_#00000035] transition duration-200 hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-[0_12px_28px_#e7001230]">
                  {game.coverUrl === null ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 grid place-items-center text-white/10"
                    >
                      <Gamepad2 size={64} />
                    </span>
                  ) : (
                    <img
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      src={game.coverUrl}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/35 transition-opacity duration-300 group-hover:opacity-85"
                  />
                  <Link
                    className="relative z-10 flex min-w-0 flex-1 flex-col rounded-xl p-3 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand"
                    to={`/jogos/${String(game.igdbId)}`}
                  >
                    <span className="block min-w-0 pr-9">
                      <span className="block line-clamp-2 text-sm font-semibold leading-tight text-content-primary">
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
                    className="absolute right-2 top-2 z-20 grid size-8 place-items-center rounded-lg bg-black/25 text-white/75 transition-colors hover:bg-black/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand"
                    disabled={removingGameId !== null || savingGameId !== null}
                    onClick={() => void removeGame(game)}
                    type="button"
                  >
                    {removingGameId === game.igdbId ? (
                      <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
                    ) : (
                      <X aria-hidden="true" size={16} />
                    )}
                  </button>
                </article>
              </li>
            ))}
          </ul>
          {pageCount > 1 ? (
            <nav
              aria-label="Paginação dos Meus Hypes"
              className="flex items-center justify-center gap-4"
            >
              <button
                aria-label="Página anterior"
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/10 px-3 text-sm font-semibold text-content-primary transition-colors enabled:hover:border-brand/50 enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                disabled={currentPage === 0}
                onClick={() => {
                  setPage((value) => Math.max(0, value - 1));
                }}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span aria-live="polite" className="text-sm text-text-muted">
                Página {String(currentPage + 1)} de {String(pageCount)}
              </span>
              <button
                aria-label="Próxima página"
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/10 px-3 text-sm font-semibold text-content-primary transition-colors enabled:hover:border-brand/50 enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                disabled={currentPage >= pageCount - 1}
                onClick={() => {
                  setPage((value) => Math.min(pageCount - 1, value + 1));
                }}
                type="button"
              >
                Próxima
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

export function MyHypesSection() {
  const { state } = useAuth();

  return (
    <section aria-labelledby="my-hypes-title" className="mt-12 border-t border-white/10 pt-8">
      <div>
        <h2
          className="mt-1 font-heading text-xl font-bold text-content-primary sm:text-2xl"
          id="my-hypes-title"
        >
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
        <p className="mt-5 rounded-xl border border-dashed border-white/15 px-5 py-6 text-center text-sm text-text-muted">
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
