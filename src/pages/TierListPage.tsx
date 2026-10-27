import { ArrowLeft, Gamepad2, LoaderCircle, Plus, Search, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Link, useParams } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { searchGames } from '@/features/games/api/game-search-client';
import { formatReleaseDate } from '@/features/releases/model/release-presentation';
import {
  createSupabaseTierListsRepository,
  type TierListsRepository,
} from '@/features/tier-lists/api/tier-lists-repository';
import {
  tierLabels,
  type TierLabel,
  type TierListDetails,
  type TierListItem,
} from '@/features/tier-lists/model/tier-lists';
import { getSupabaseClient } from '@/shared/supabase/client';

import type { GameSearchResult } from '../../shared/contracts/game-search';

type PageState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'not-found' }
  | { readonly status: 'ready'; readonly list: TierListDetails };

type SearchState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'success'; readonly games: readonly GameSearchResult[] };

const tierStyles: Record<TierLabel, { readonly background: string; readonly foreground: string }> =
  {
    S: { background: 'bg-[#ff7a7a]', foreground: 'text-[#241112]' },
    A: { background: 'bg-[#ffbf7a]', foreground: 'text-[#241a10]' },
    B: { background: 'bg-[#ffe07a]', foreground: 'text-[#241f10]' },
    C: { background: 'bg-[#ffff83]', foreground: 'text-[#22220b]' },
    D: { background: 'bg-[#b7ff87]', foreground: 'text-[#17220e]' },
  };

function nextPosition(items: readonly TierListItem[]): number {
  return items.reduce((maximum, item) => Math.max(maximum, item.position), -1) + 1;
}

function TierGameTile({
  disabled,
  game,
  onDragStart,
}: Readonly<{
  disabled: boolean;
  game: TierListItem;
  onDragStart: (event: DragEvent<HTMLButtonElement>, gameId: number) => void;
}>) {
  return (
    <button
      aria-label={`Arraste ${game.name} para um tier`}
      className="group flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-lg p-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-grabbing disabled:opacity-50"
      disabled={disabled}
      draggable={!disabled}
      onDragStart={(event) => onDragStart(event, game.igdbId)}
      title={game.name}
      type="button"
    >
      {game.coverUrl === null ? (
        <span className="grid size-[68px] place-items-center rounded-md bg-bg-secondary text-text-muted">
          <Gamepad2 aria-hidden="true" size={24} />
        </span>
      ) : (
        <img
          alt=""
          className="size-[68px] rounded-md object-cover transition group-hover:brightness-110"
          draggable={false}
          loading="lazy"
          src={game.coverUrl}
        />
      )}
      <span className="w-full truncate text-[10px] font-semibold text-content-primary">
        {game.name}
      </span>
    </button>
  );
}

function startGameDrag(event: DragEvent<HTMLButtonElement>, gameId: number) {
  event.dataTransfer.setData('text/plain', String(gameId));
  event.dataTransfer.effectAllowed = 'move';
}

function handleGameDrop(
  event: DragEvent<HTMLDivElement>,
  tier: TierLabel | null,
  onMove: (gameId: number, tier: TierLabel | null) => void,
) {
  event.preventDefault();
  const gameId = Number(event.dataTransfer.getData('text/plain'));
  if (Number.isSafeInteger(gameId) && gameId > 0) onMove(gameId, tier);
}

function TierRow({
  disabled,
  items,
  onMove,
  tier,
}: Readonly<{
  disabled: boolean;
  items: readonly TierListItem[];
  onMove: (gameId: number, tier: TierLabel | null) => void;
  tier: TierLabel;
}>) {
  const style = tierStyles[tier];

  return (
    <div className="grid min-h-28 grid-cols-[76px_minmax(0,1fr)] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] sm:grid-cols-[96px_minmax(0,1fr)]">
      <div
        className={`grid place-items-center font-heading text-xl font-bold ${style.background} ${style.foreground}`}
      >
        {tier}
      </div>
      <div
        aria-label={`Tier ${tier}. Solte jogos aqui`}
        className="flex min-h-28 flex-wrap content-start items-start gap-1 border-l border-black/30 p-2 transition-colors hover:bg-brand/5 sm:p-2.5"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => handleGameDrop(event, tier, onMove)}
        role="region"
      >
        {items.length === 0 ? (
          <span className="self-center px-2 py-3 text-xs text-text-muted">Solte jogos aqui</span>
        ) : (
          items.map((game) => (
            <TierGameTile
              disabled={disabled}
              game={game}
              key={game.igdbId}
              onDragStart={startGameDrag}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TierListEditor({
  list,
  onGameAdded,
  repository,
}: Readonly<{
  list: TierListDetails;
  onGameAdded: () => void;
  repository: TierListsRepository;
}>) {
  const [items, setItems] = useState(list.items);
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [movingGameId, setMovingGameId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void searchGames(normalizedQuery, { signal: controller.signal })
        .then((games) => {
          if (!controller.signal.aborted) setSearchState({ status: 'success', games });
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchState({ status: 'error' });
        });
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const addGame = async (game: GameSearchResult) => {
    if (addingGameId !== null || movingGameId !== null) return;
    setAddingGameId(game.id);
    setActionError(null);

    try {
      const position = nextPosition(items.filter((item) => item.tier === null));
      await repository.addGame(list.id, game, position);
      const addedItem: TierListItem = {
        coverUrl: game.coverUrl,
        igdbId: game.id,
        name: game.name,
        position,
        releaseDate: game.releaseDate,
        tier: null,
      };
      setItems((current) => [...current, addedItem]);
      onGameAdded();
      setQuery('');
      setSearchState({ status: 'idle' });
    } catch {
      setActionError('Não foi possível adicionar o jogo à Tier List. Tente novamente.');
    } finally {
      setAddingGameId(null);
    }
  };

  const moveGame = async (gameId: number, targetTier: TierLabel | null) => {
    if (movingGameId !== null || addingGameId !== null) return;
    const game = items.find((item) => item.igdbId === gameId);
    if (game === undefined || game.tier === targetTier) return;

    setMovingGameId(gameId);
    setActionError(null);
    const targetItems = items.filter((item) => item.tier === targetTier && item.igdbId !== gameId);
    const position = nextPosition(targetItems);

    try {
      await repository.moveGame(list.id, gameId, targetTier, position);
      setItems((current) =>
        current.map((item) =>
          item.igdbId === gameId ? { ...item, tier: targetTier, position } : item,
        ),
      );
    } catch {
      setActionError('Não foi possível mover o jogo. Tente novamente.');
    } finally {
      setMovingGameId(null);
    }
  };

  const queryIsLongEnough = query.trim().length >= 2;
  const searchContent =
    searchState.status === 'loading' ? (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-muted" role="status">
        <LoaderCircle aria-hidden="true" className="animate-spin text-brand" size={16} />
        Buscando jogos…
      </div>
    ) : searchState.status === 'error' ? (
      <p className="px-4 py-3 text-sm text-brand-bright" role="alert">
        Não foi possível buscar jogos. Tente novamente.
      </p>
    ) : searchState.status === 'success' && searchState.games.length === 0 ? (
      <p className="px-4 py-3 text-sm text-text-muted">Nenhum jogo encontrado.</p>
    ) : searchState.status === 'success' ? (
      <ul aria-label="Resultados da busca" className="max-h-80 overflow-y-auto p-1.5">
        {searchState.games.map((game) => {
          const isAdded = items.some((item) => item.igdbId === game.id);
          return (
            <li key={game.id}>
              <button
                aria-pressed={isAdded}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAdded || addingGameId !== null || movingGameId !== null}
                onClick={() => void addGame(game)}
                type="button"
              >
                {game.coverUrl === null ? (
                  <span className="grid size-12 shrink-0 place-items-center rounded-md bg-surface-raised text-text-muted">
                    <Gamepad2 aria-hidden="true" size={18} />
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
                    'Adicionado'
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

  const unrankedItems = items
    .filter((item) => item.tier === null)
    .sort((left, right) => left.position - right.position);
  const disabled = addingGameId !== null || movingGameId !== null;

  return (
    <div className="mt-7 space-y-7">
      <div className="space-y-2">
        <label className="sr-only" htmlFor="tier-list-game-search">
          Buscar jogos para adicionar à Tier List
        </label>
        <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border-brand bg-bg-secondary px-4 focus-within:border-brand/70">
          <Search aria-hidden="true" className="shrink-0 text-text-muted" size={18} />
          <input
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-text-muted"
            id="tier-list-game-search"
            onChange={(event) => {
              const nextQuery = event.currentTarget.value;
              setQuery(nextQuery);
              setSearchState(
                nextQuery.trim().length >= 2 ? { status: 'loading' } : { status: 'idle' },
              );
            }}
            placeholder="Buscar jogos pelo nome…"
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
        <p
          className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <section aria-labelledby="unranked-games-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2
            className="font-heading text-xl font-bold text-content-primary"
            id="unranked-games-heading"
          >
            Jogos sem tier
          </h2>
          <span className="text-xs text-text-muted">Arraste para uma categoria</span>
        </div>
        <div
          aria-label="Jogos sem tier. Solte aqui para retirar um jogo de sua categoria"
          className="flex min-h-24 flex-wrap content-start gap-1 rounded-xl border border-dashed border-white/20 bg-surface/40 p-2 transition-colors hover:border-brand/50 hover:bg-brand/5 sm:p-3"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => handleGameDrop(event, null, moveGame)}
          role="region"
        >
          {unrankedItems.length === 0 ? (
            <p className="self-center px-2 py-3 text-xs text-text-muted">
              Adicione jogos na busca para começar sua classificação.
            </p>
          ) : (
            unrankedItems.map((game) => (
              <TierGameTile
                disabled={disabled}
                game={game}
                key={game.igdbId}
                onDragStart={startGameDrag}
              />
            ))
          )}
        </div>
      </section>

      <section aria-label="Categorias da Tier List" className="space-y-2">
        {tierLabels.map((tier) => (
          <TierRow
            disabled={disabled}
            items={items
              .filter((item) => item.tier === tier)
              .sort((left, right) => left.position - right.position)}
            key={tier}
            onMove={moveGame}
            tier={tier}
          />
        ))}
      </section>
      {movingGameId === null ? null : (
        <p className="sr-only" role="status">
          Atualizando a categoria do jogo…
        </p>
      )}
      {addingGameId === null ? null : (
        <p className="sr-only" role="status">
          Adicionando jogo…
        </p>
      )}
    </div>
  );
}

export function TierListPage() {
  const { tierListId: rawTierListId } = useParams();
  const parsedTierListId =
    rawTierListId !== undefined && /^\d+$/.test(rawTierListId) ? Number(rawTierListId) : NaN;
  const tierListId =
    Number.isSafeInteger(parsedTierListId) && parsedTierListId > 0 ? parsedTierListId : null;
  const { state: authState } = useAuth();
  const userId = authState.status === 'authenticated' ? authState.user.id : null;
  const client = useMemo(() => getSupabaseClient(), []);
  const repository = useMemo(
    () => (client === null ? null : createSupabaseTierListsRepository(client)),
    [client],
  );
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' });
  const [gameCount, setGameCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (repository === null || userId === null || tierListId === null) {
      setPageState({ status: 'error' });
      return;
    }

    let active = true;
    setPageState({ status: 'loading' });
    void repository
      .getList(userId, tierListId)
      .then((list) => {
        if (!active) return;
        setGameCount(list?.gameCount ?? 0);
        setPageState(list === null ? { status: 'not-found' } : { status: 'ready', list });
      })
      .catch(() => {
        if (active) setPageState({ status: 'error' });
      });

    return () => {
      active = false;
    };
  }, [repository, retryKey, tierListId, userId]);

  return (
    <main className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pb-28 pt-7 sm:px-5 sm:pb-12 lg:px-8 lg:pt-9">
      <Link
        className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-text-muted transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        to="/minhas-listas"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Minhas listas
      </Link>

      {pageState.status === 'loading' ? (
        <p className="py-16 text-center text-sm text-text-muted" role="status">
          Carregando Tier List…
        </p>
      ) : pageState.status === 'not-found' ? (
        <div className="py-16 text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto text-brand-bright" size={32} />
          <p className="mt-3 text-sm text-text-muted">Esta Tier List não foi encontrada.</p>
        </div>
      ) : pageState.status === 'error' ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-100" role="alert">
            Não foi possível carregar esta Tier List.
          </p>
          <button
            className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-content-primary"
            onClick={() => setRetryKey((value) => value + 1)}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-bright">
                Tier List
              </p>
              <h1 className="mt-1 break-words font-heading text-3xl font-bold text-content-primary sm:text-4xl">
                {pageState.list.name}
              </h1>
              {pageState.list.description === null ? null : (
                <p className="mt-2 text-sm text-text-muted">{pageState.list.description}</p>
              )}
            </div>
            <span className="text-sm text-text-muted">
              {String(gameCount)} {gameCount === 1 ? 'jogo' : 'jogos'}
            </span>
          </div>
          {repository === null || userId === null ? (
            <p className="mt-6 text-sm text-red-100" role="alert">
              O serviço de Tier Lists não está disponível.
            </p>
          ) : (
            <TierListEditor
              key={`${String(pageState.list.id)}:${String(retryKey)}`}
              list={pageState.list}
              onGameAdded={() => setGameCount((count) => count + 1)}
              repository={repository}
            />
          )}
        </>
      )}
    </main>
  );
}
