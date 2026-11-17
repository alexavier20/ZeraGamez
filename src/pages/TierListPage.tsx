import {
  ArrowLeft,
  Gamepad2,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FocusEvent,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router';
import { ZodError } from 'zod';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { searchGames } from '@/features/games/api/game-search-client';
import { normalizeCreateListInput } from '@/features/lists/model/lists';
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
import { GameRowsLoading, TierBoardLoading } from '@/shared/components/LoadingSkeletons';
import { getSupabaseClient } from '@/shared/supabase/client';
import { DataError } from '@/shared/supabase/data-error';

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

type DropEdge = 'before' | 'after';

interface TierGameTooltipPosition {
  readonly above: boolean;
  readonly left: number;
  readonly top: number;
}

const tierStyles: Record<TierLabel, { readonly background: string; readonly foreground: string }> =
  {
    S: { background: 'bg-brand', foreground: 'text-brand-ink' },
    A: { background: 'bg-secondary', foreground: 'text-brand-ink' },
    B: { background: 'bg-bg-secondary', foreground: 'text-text-primary' },
    C: { background: 'bg-border', foreground: 'text-text-primary' },
    D: { background: 'bg-app', foreground: 'text-text-primary' },
  };

function nextPosition(items: readonly TierListItem[]): number {
  return items.reduce((maximum, item) => Math.max(maximum, item.position), -1) + 1;
}

function reorderTierItems(
  items: readonly TierListItem[],
  gameId: number,
  targetTier: TierLabel | null,
  targetPosition: number,
): readonly TierListItem[] | null {
  const game = items.find((item) => item.igdbId === gameId);
  if (game === undefined) return null;

  const sourceTier = game.tier;
  const sourceItems = items
    .filter((item) => item.tier === sourceTier && item.igdbId !== gameId)
    .sort((left, right) => left.position - right.position);
  const targetItems =
    sourceTier === targetTier
      ? sourceItems
      : items
          .filter((item) => item.tier === targetTier && item.igdbId !== gameId)
          .sort((left, right) => left.position - right.position);
  const position = Math.max(0, Math.min(targetPosition, targetItems.length));
  const reorderedTarget = [...targetItems];
  reorderedTarget.splice(position, 0, { ...game, tier: targetTier });
  const targetPositions = new Map(
    reorderedTarget.map((item, index) => [item.igdbId, index] as const),
  );
  const sourcePositions = new Map(sourceItems.map((item, index) => [item.igdbId, index] as const));

  return items.map((item) => {
    if (item.igdbId === gameId || item.tier === targetTier) {
      return { ...item, tier: targetTier, position: targetPositions.get(item.igdbId) ?? position };
    }
    if (sourceTier !== targetTier && item.tier === sourceTier) {
      return { ...item, position: sourcePositions.get(item.igdbId) ?? item.position };
    }
    return item;
  });
}

function getTierGameTooltipPosition(element: HTMLElement): TierGameTooltipPosition {
  const bounds = element.getBoundingClientRect();
  const above = bounds.top > 340;
  return {
    above,
    left: Math.max(112, Math.min(window.innerWidth - 112, bounds.left + bounds.width / 2)),
    top: above ? bounds.top - 10 : bounds.bottom + 10,
  };
}

function TierGameTile({
  disabled,
  dragging,
  dropEdge,
  game,
  onDragEnd,
  onDragOverGame,
  onDropOnGame,
  onRemove,
  onDragStart,
  removing,
}: Readonly<{
  disabled: boolean;
  dragging: boolean;
  dropEdge: DropEdge | null;
  game: TierListItem;
  onDragEnd: () => void;
  onDragOverGame: (event: DragEvent<HTMLDivElement>, gameId: number, edge: DropEdge) => void;
  onDropOnGame: (event: DragEvent<HTMLDivElement>, gameId: number, edge: DropEdge) => void;
  onRemove: (gameId: number) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, gameId: number) => void;
  removing: boolean;
}>) {
  const tileRef = useRef<HTMLDivElement>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const tooltipId = useId();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TierGameTooltipPosition | null>(null);

  const hideTooltip = () => {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTooltipVisible(false);
  };

  const scheduleTooltip = () => {
    if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = window.setTimeout(() => {
      const tile = tileRef.current;
      if (tile === null) return;
      setTooltipPosition(getTierGameTooltipPosition(tile));
      setTooltipVisible(true);
      tooltipTimerRef.current = null;
    }, 650);
  };

  useEffect(
    () => () => {
      if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!tooltipVisible) return;
    const updatePosition = () => {
      const tile = tileRef.current;
      if (tile !== null) setTooltipPosition(getTierGameTooltipPosition(tile));
    };
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [tooltipVisible]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideTooltip();
  };

  return (
    <div
      className="group relative w-[96px] shrink-0"
      onBlur={handleBlur}
      onDragOver={(event) => {
        if (disabled || dragging) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const edge =
          event.clientX <
          event.currentTarget.getBoundingClientRect().left +
            event.currentTarget.getBoundingClientRect().width / 2
            ? 'before'
            : 'after';
        onDragOverGame(event, game.igdbId, edge);
      }}
      onDrop={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const edge = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after';
        onDropOnGame(event, game.igdbId, edge);
      }}
      onFocus={() => {
        scheduleTooltip();
      }}
      onMouseEnter={scheduleTooltip}
      onMouseLeave={hideTooltip}
      ref={tileRef}
    >
      {dropEdge === null ? null : (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-1 z-20 w-1 rounded-full bg-brand shadow-[0_0_0_2px_#fff] ${dropEdge === 'before' ? 'left-0' : 'right-0'}`}
        />
      )}
      <button
        aria-describedby={tooltipVisible ? tooltipId : undefined}
        aria-label={`Arraste ${game.name} para um tier ou para reordenar os jogos`}
        className={`flex w-full flex-col items-center gap-1 p-1 text-center transition-[opacity,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright ${dragging ? 'scale-95 cursor-grabbing opacity-40' : 'cursor-grab active:cursor-grabbing'} disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={disabled}
        draggable={!disabled}
        onDragEnd={onDragEnd}
        onDragStart={(event) => {
          hideTooltip();
          onDragStart(event, game.igdbId);
        }}
        type="button"
      >
        {game.coverUrl === null ? (
          <span className="grid size-[88px] place-items-center bg-bg-secondary text-text-muted">
            <Gamepad2 aria-hidden="true" size={24} />
          </span>
        ) : (
          <img
            alt=""
            className="size-[88px] object-cover transition group-hover:brightness-110"
            draggable={false}
            loading="lazy"
            src={game.coverUrl}
          />
        )}
        <span className="w-full truncate text-[10px] font-semibold text-content-primary">
          {game.name}
        </span>
      </button>
      <button
        aria-label={`Remover ${game.name} da Tier List`}
        className="absolute right-1 top-1 z-10 grid size-7 place-items-center rounded-full border border-white bg-red-600 text-white shadow-md transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={() => {
          onRemove(game.igdbId);
        }}
        title={`Remover ${game.name}`}
        type="button"
      >
        {removing ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
        ) : (
          <X aria-hidden="true" size={16} strokeWidth={2.5} />
        )}
      </button>
      {tooltipVisible && tooltipPosition !== null
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[80] w-44 border border-border bg-surface p-2 shadow-[0_14px_36px_#00000080] sm:w-52"
              id={tooltipId}
              role="tooltip"
              style={{
                left: tooltipPosition.left,
                top: tooltipPosition.top,
                transform: tooltipPosition.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              }}
            >
              {game.coverUrl === null ? (
                <span className="grid aspect-square max-h-[50dvh] place-items-center bg-bg-secondary text-text-muted">
                  <Gamepad2 aria-hidden="true" size={32} />
                </span>
              ) : (
                <img
                  alt=""
                  className="aspect-square max-h-[50dvh] w-full object-cover"
                  draggable={false}
                  src={game.coverUrl}
                />
              )}
              <p className="mt-2 line-clamp-2 text-sm font-bold text-content-primary">
                {game.name}
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function startGameDrag(event: DragEvent<HTMLButtonElement>, gameId: number) {
  event.dataTransfer.setData('text/plain', String(gameId));
  event.dataTransfer.effectAllowed = 'move';
}

function handleGameDrop(
  event: DragEvent<HTMLDivElement>,
  tier: TierLabel | null,
  onMove: (gameId: number, tier: TierLabel | null, position?: number) => void,
) {
  event.preventDefault();
  const gameId = Number(event.dataTransfer.getData('text/plain'));
  if (Number.isSafeInteger(gameId) && gameId > 0) onMove(gameId, tier);
}

function autoScrollPage(pointerY: number) {
  const edgeSize = Math.min(96, Math.max(52, window.innerHeight * 0.14));
  const maxScrollStep = 16;

  if (pointerY < edgeSize) {
    const intensity = 1 - pointerY / edgeSize;
    window.scrollBy(0, -Math.ceil(maxScrollStep * intensity));
  } else if (pointerY > window.innerHeight - edgeSize) {
    const distanceFromBottom = window.innerHeight - pointerY;
    const intensity = 1 - distanceFromBottom / edgeSize;
    window.scrollBy(0, Math.ceil(maxScrollStep * intensity));
  }
}

function TierRow({
  disabled,
  draggedGameId,
  items,
  onDragEnd,
  dropTarget,
  onDragOverGame,
  onDropOnGame,
  onRemove,
  onDragStart,
  onMove,
  removingGameId,
  tier,
}: Readonly<{
  disabled: boolean;
  draggedGameId: number | null;
  dropTarget: { readonly edge: DropEdge; readonly gameId: number } | null;
  items: readonly TierListItem[];
  onDragEnd: () => void;
  onDragOverGame: (event: DragEvent<HTMLDivElement>, gameId: number, edge: DropEdge) => void;
  onDropOnGame: (event: DragEvent<HTMLDivElement>, gameId: number, edge: DropEdge) => void;
  onRemove: (gameId: number) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, gameId: number) => void;
  onMove: (gameId: number, tier: TierLabel | null, position?: number) => void;
  removingGameId: number | null;
  tier: TierLabel;
}>) {
  const style = tierStyles[tier];

  return (
    <div className="grid min-h-36 grid-cols-[76px_minmax(0,1fr)] overflow-hidden border border-border bg-bg-secondary sm:grid-cols-[96px_minmax(0,1fr)]">
      <div
        className={`grid place-items-center font-heading text-xl font-bold ${style.background} ${style.foreground}`}
      >
        {tier}
      </div>
      <div
        aria-label={`Tier ${tier}. Solte jogos aqui ou antes e depois de outro jogo para ordenar`}
        className="flex min-h-36 flex-wrap content-start items-start gap-1 border-l border-border p-2 transition-colors hover:bg-brand/5 sm:p-2.5"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          handleGameDrop(event, tier, onMove);
          onDragEnd();
        }}
        role="region"
      >
        {items.length === 0 ? (
          <span className="self-center px-2 py-3 text-xs text-text-muted">Solte jogos aqui</span>
        ) : (
          items.map((game) => (
            <TierGameTile
              disabled={disabled}
              dragging={draggedGameId === game.igdbId}
              dropEdge={dropTarget?.gameId === game.igdbId ? dropTarget.edge : null}
              game={game}
              key={game.igdbId}
              onDragEnd={onDragEnd}
              onDragOverGame={onDragOverGame}
              onDropOnGame={onDropOnGame}
              onRemove={onRemove}
              onDragStart={onDragStart}
              removing={removingGameId === game.igdbId}
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
  onGameRemoved,
  repository,
}: Readonly<{
  list: TierListDetails;
  onGameAdded: () => void;
  onGameRemoved: () => void;
  repository: TierListsRepository;
}>) {
  const [items, setItems] = useState(list.items);
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [removingGameId, setRemovingGameId] = useState<number | null>(null);
  const [movingGameId, setMovingGameId] = useState<number | null>(null);
  const [draggedGameId, setDraggedGameId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    readonly edge: DropEdge;
    readonly gameId: number;
  } | null>(null);
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
    if (addingGameId !== null || movingGameId !== null || removingGameId !== null) return;
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

  const moveGame = async (
    gameId: number,
    targetTier: TierLabel | null,
    requestedPosition?: number,
  ) => {
    if (movingGameId !== null || addingGameId !== null || removingGameId !== null) return;
    const game = items.find((item) => item.igdbId === gameId);
    if (game === undefined) return;

    const targetItems = items
      .filter((item) => item.tier === targetTier && item.igdbId !== gameId)
      .sort((left, right) => left.position - right.position);
    const position = Math.max(
      0,
      Math.min(requestedPosition ?? targetItems.length, targetItems.length),
    );
    const nextItems = reorderTierItems(items, gameId, targetTier, position);
    if (nextItems === null) return;
    const orderChanged = nextItems.some(
      (item, index) =>
        item.igdbId !== items[index]?.igdbId ||
        item.tier !== items[index]?.tier ||
        item.position !== items[index]?.position,
    );
    if (!orderChanged) return;

    setMovingGameId(gameId);
    setActionError(null);

    try {
      await repository.moveGame(list.id, gameId, targetTier, position);
      setItems(nextItems);
    } catch {
      setActionError('Não foi possível alterar a ordem dos jogos. Tente novamente.');
    } finally {
      setMovingGameId(null);
    }
  };

  const handleGameDragOver = (event: DragEvent<HTMLDivElement>, gameId: number, edge: DropEdge) => {
    if (draggedGameId === null || draggedGameId === gameId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget((current) =>
      current?.gameId === gameId && current.edge === edge ? current : { gameId, edge },
    );
  };

  const handleGameDropOnTile = (
    event: DragEvent<HTMLDivElement>,
    targetGameId: number,
    edge: DropEdge,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const droppedId = Number(event.dataTransfer.getData('text/plain'));
    const sourceGameId = draggedGameId ?? droppedId;
    const targetGame = items.find((item) => item.igdbId === targetGameId);
    const targetItems = items
      .filter((item) => item.tier === targetGame?.tier && item.igdbId !== sourceGameId)
      .sort((left, right) => left.position - right.position);
    const targetIndex = targetItems.findIndex((item) => item.igdbId === targetGameId);

    if (
      Number.isSafeInteger(sourceGameId) &&
      sourceGameId > 0 &&
      targetGame !== undefined &&
      targetIndex >= 0
    ) {
      void moveGame(sourceGameId, targetGame.tier, targetIndex + (edge === 'after' ? 1 : 0));
    }
    setDropTarget(null);
    stopDraggingGame();
  };

  const removeGame = async (gameId: number) => {
    if (movingGameId !== null || addingGameId !== null || removingGameId !== null) return;
    const game = items.find((item) => item.igdbId === gameId);
    if (game === undefined) return;

    setRemovingGameId(gameId);
    setActionError(null);
    try {
      await repository.removeGame(list.id, gameId);
      setItems((current) => current.filter((item) => item.igdbId !== gameId));
      onGameRemoved();
    } catch {
      setActionError('Não foi possível remover o jogo da Tier List. Tente novamente.');
    } finally {
      setRemovingGameId(null);
    }
  };

  const startDraggingGame = (event: DragEvent<HTMLButtonElement>, gameId: number) => {
    startGameDrag(event, gameId);
    setDropTarget(null);
    setDraggedGameId(gameId);
  };

  const stopDraggingGame = () => {
    setDropTarget(null);
    setDraggedGameId(null);
  };

  const queryIsLongEnough = query.trim().length >= 2;
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
      <ul aria-label="Resultados da busca" className="max-h-80 overflow-y-auto p-1.5">
        {searchState.games.map((game) => {
          const isAdded = items.some((item) => item.igdbId === game.id);
          return (
            <li key={game.id}>
              <button
                aria-pressed={isAdded}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isAdded ||
                  addingGameId !== null ||
                  movingGameId !== null ||
                  removingGameId !== null
                }
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
  const disabled = addingGameId !== null || movingGameId !== null || removingGameId !== null;

  return (
    <div
      className="mt-7 space-y-7"
      onDragOver={(event) => {
        if (draggedGameId !== null) autoScrollPage(event.clientY);
      }}
      style={{ overflowAnchor: draggedGameId === null ? 'auto' : 'none' }}
    >
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
          className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700"
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
          <span className="text-xs text-text-muted">Arraste para mudar o tier ou a ordem</span>
        </div>
        <div
          aria-label="Jogos sem tier. Solte aqui para retirar um jogo de sua categoria ou ordene entre os jogos"
          className="flex min-h-32 flex-wrap content-start gap-1 border border-dashed border-border bg-surface/40 p-2 transition-colors hover:border-brand/50 hover:bg-brand/5 sm:p-3"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            handleGameDrop(event, null, moveGame);
            stopDraggingGame();
          }}
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
                dragging={draggedGameId === game.igdbId}
                dropEdge={dropTarget?.gameId === game.igdbId ? dropTarget.edge : null}
                game={game}
                key={game.igdbId}
                onDragEnd={stopDraggingGame}
                onDragOverGame={handleGameDragOver}
                onDropOnGame={handleGameDropOnTile}
                onRemove={removeGame}
                onDragStart={startDraggingGame}
                removing={removingGameId === game.igdbId}
              />
            ))
          )}
        </div>
      </section>

      <section aria-label="Categorias da Tier List" className="space-y-2">
        {tierLabels.map((tier) => (
          <TierRow
            disabled={disabled}
            draggedGameId={draggedGameId}
            dropTarget={dropTarget}
            items={items
              .filter((item) => item.tier === tier)
              .sort((left, right) => left.position - right.position)}
            key={tier}
            onDragEnd={stopDraggingGame}
            onDragOverGame={handleGameDragOver}
            onDropOnGame={handleGameDropOnTile}
            onRemove={removeGame}
            onDragStart={startDraggingGame}
            onMove={moveGame}
            removingGameId={removingGameId}
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
      {removingGameId === null ? null : (
        <p className="sr-only" role="status">
          Removendo jogo da Tier List…
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
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
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
        setEditName(list?.name ?? '');
        setEditDescription(list?.description ?? '');
        setEditingMetadata(false);
        setEditError(null);
        setPageState(list === null ? { status: 'not-found' } : { status: 'ready', list });
      })
      .catch(() => {
        if (active) setPageState({ status: 'error' });
      });

    return () => {
      active = false;
    };
  }, [repository, retryKey, tierListId, userId]);

  useEffect(() => {
    if (editingMetadata) nameInputRef.current?.focus();
  }, [editingMetadata]);

  const saveMetadata = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current || repository === null || pageState.status !== 'ready') return;

    let normalized;
    try {
      normalized = normalizeCreateListInput({ name: editName, description: editDescription });
    } catch (error) {
      setEditError(
        error instanceof ZodError
          ? (error.issues[0]?.message ?? 'Confira os dados da lista.')
          : 'Confira os dados da lista.',
      );
      return;
    }

    savingRef.current = true;
    setSavingMetadata(true);
    setEditError(null);
    try {
      await repository.updateList(pageState.list.id, normalized);
      const description = normalized.description || null;
      setPageState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              list: { ...current.list, name: normalized.name, description },
            }
          : current,
      );
      setEditName(normalized.name);
      setEditDescription(normalized.description);
      setEditingMetadata(false);
    } catch (error) {
      setEditError(
        error instanceof DataError && error.code === 'list_name_conflict'
          ? error.message
          : 'Não foi possível salvar as alterações. Tente novamente.',
      );
    } finally {
      savingRef.current = false;
      setSavingMetadata(false);
    }
  };

  return (
    <main className="site-container min-h-[calc(100dvh-3.5rem)] pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7">
      <Link
        className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-text-muted transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-bright"
        to="/minhas-listas"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Minhas listas
      </Link>

      {pageState.status === 'loading' ? (
        <TierBoardLoading />
      ) : pageState.status === 'not-found' ? (
        <div className="py-16 text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto text-icon" size={32} />
          <p className="mt-3 text-sm text-text-muted">Esta Tier List não foi encontrada.</p>
        </div>
      ) : pageState.status === 'error' ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-700" role="alert">
            Não foi possível carregar esta Tier List.
          </p>
          <button
            className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-bold text-content-primary"
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="break-words font-heading text-3xl font-bold text-content-primary sm:text-4xl">
                {pageState.list.name}
              </h1>
              {pageState.list.description === null ? null : (
                <p className="mt-2 text-sm text-text-muted">{pageState.list.description}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm text-text-muted">
                {String(gameCount)} {gameCount === 1 ? 'jogo' : 'jogos'}
              </span>
              {editingMetadata ? null : (
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border-brand bg-bg-secondary px-3 text-sm font-bold text-content-primary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
                  disabled={repository === null || savingMetadata}
                  onClick={() => {
                    setEditError(null);
                    setEditingMetadata(true);
                  }}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={15} />
                  Editar
                </button>
              )}
            </div>
          </div>
          {editingMetadata ? (
            <form
              className="mt-6 space-y-4 border border-border bg-surface p-5 sm:p-6"
              onSubmit={(event) => {
                void saveMetadata(event);
              }}
            >
              <div>
                <label
                  className="mb-2 block text-sm font-bold text-content-primary"
                  htmlFor="tier-list-edit-name"
                >
                  Nome da lista
                </label>
                <input
                  className="min-h-11 w-full rounded-xl border border-border bg-bg-secondary px-4 text-content-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-bright/30"
                  disabled={savingMetadata}
                  id="tier-list-edit-name"
                  maxLength={80}
                  onChange={(event) => {
                    setEditName(event.target.value);
                  }}
                  ref={nameInputRef}
                  value={editName}
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-bold text-content-primary"
                  htmlFor="tier-list-edit-description"
                >
                  Descrição
                </label>
                <textarea
                  className="min-h-24 w-full resize-y rounded-xl border border-border bg-bg-secondary px-4 py-3 text-content-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-bright/30"
                  disabled={savingMetadata}
                  id="tier-list-edit-description"
                  maxLength={500}
                  onChange={(event) => {
                    setEditDescription(event.target.value);
                  }}
                  value={editDescription}
                />
              </div>
              {editError === null ? null : (
                <p
                  className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700"
                  role="alert"
                >
                  {editError}
                </p>
              )}
              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <button
                  className="min-h-10 rounded-xl border border-border-brand px-4 text-sm font-semibold text-content-primary disabled:opacity-60"
                  disabled={savingMetadata}
                  onClick={() => {
                    setEditName(pageState.list.name);
                    setEditDescription(pageState.list.description ?? '');
                    setEditError(null);
                    setEditingMetadata(false);
                  }}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 cut-corner-button bg-brand px-4 text-sm font-bold text-brand-ink transition-colors duration-150 hover:bg-brand-hover hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={savingMetadata}
                  type="submit"
                >
                  {savingMetadata ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
                  ) : null}
                  {savingMetadata ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          ) : null}
          {repository === null || userId === null ? (
            <p className="mt-6 text-sm text-red-700" role="alert">
              O serviço de Tier Lists não está disponível.
            </p>
          ) : (
            <TierListEditor
              key={`${String(pageState.list.id)}:${String(retryKey)}`}
              list={pageState.list}
              onGameAdded={() => {
                setGameCount((count) => count + 1);
              }}
              onGameRemoved={() => {
                setGameCount((count) => Math.max(0, count - 1));
              }}
              repository={repository}
            />
          )}
        </>
      )}
    </main>
  );
}
