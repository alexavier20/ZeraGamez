import { Gamepad2, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type SubmitEventHandler } from 'react';
import { Link } from 'react-router';

import { getMostAnticipatedGames, searchGames } from '@/features/games/api/game-search-client';

import { headerCopy } from './header.config';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';

interface GlobalSearchProps {
  readonly className?: string;
  readonly onSearch?: (query: string) => void;
}

type SearchState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly games: readonly GameSearchResult[] }
  | { readonly status: 'error' };

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

function formatReleaseDate(value: string | null): string {
  if (value === null) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function gameMetadata(game: GameSearchResult): string {
  const platforms =
    game.platforms.length > 0
      ? game.platforms.slice(0, 2).join(' · ')
      : 'Plataformas não informadas';
  return `${platforms} · ${formatReleaseDate(game.releaseDate)}`;
}

export function GlobalSearch({ className = '', onSearch }: Readonly<GlobalSearchProps>) {
  const inputId = useId();
  const resultsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const normalizedQuery = query.trim();
  const showSuggestions =
    isOpen && (normalizedQuery.length === 0 || normalizedQuery.length >= MIN_SEARCH_LENGTH);

  useEffect(() => {
    if (!isOpen || (normalizedQuery.length > 0 && normalizedQuery.length < MIN_SEARCH_LENGTH)) {
      return;
    }

    const controller = new AbortController();
    const loadGames = () => {
      const request =
        normalizedQuery.length === 0
          ? getMostAnticipatedGames({ signal: controller.signal })
          : searchGames(normalizedQuery, { signal: controller.signal });
      void request
        .then((games) => {
          if (!controller.signal.aborted) setSearchState({ status: 'success', games });
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchState({ status: 'error' });
        });
    };
    setSearchState({ status: 'loading' });
    const timeoutId =
      normalizedQuery.length === 0 ? undefined : window.setTimeout(loadGames, SEARCH_DEBOUNCE_MS);
    if (timeoutId === undefined) loadGames();

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isOpen, normalizedQuery]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (normalizedQuery.length === 0) {
      return;
    }

    setIsOpen(false);
    onSearch?.(normalizedQuery);
  };

  return (
    <div className={`relative min-w-0 ${className}`} ref={containerRef}>
      <form
        className="flex h-10 w-full items-center gap-2 rounded-xl border-0 bg-brand px-3.5"
        onSubmit={handleSubmit}
        role="search"
      >
        <label className="sr-only" htmlFor={inputId}>
          {headerCopy.searchLabel}
        </label>
        <button
          aria-label={headerCopy.searchButtonLabel}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-200"
          type="submit"
        >
          <Search aria-hidden="true" size={18} />
        </button>
        <input
          aria-autocomplete="list"
          aria-controls={resultsId}
          aria-expanded={showSuggestions}
          aria-busy={searchState.status === 'loading'}
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-200"
          id={inputId}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setIsOpen(true);
            setSearchState(
              nextQuery.trim().length >= MIN_SEARCH_LENGTH
                ? { status: 'loading' }
                : { status: 'idle' },
            );
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
          }}
          placeholder={headerCopy.searchPlaceholder}
          type="search"
          value={query}
        />
      </form>

      {showSuggestions && (
        <div
          aria-label="Sugestões de jogos"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-brand/30 bg-bg-secondary shadow-2xl"
          id={resultsId}
          role="region"
          aria-live="polite"
        >
          {searchState.status === 'loading' ? (
            <div
              className="flex items-center gap-2 px-4 py-3 text-sm text-text-muted"
              role="status"
            >
              <LoaderCircle aria-hidden="true" className="animate-spin text-brand" size={16} />
              {normalizedQuery.length === 0 ? 'Carregando jogos…' : 'Buscando jogos…'}
            </div>
          ) : searchState.status === 'error' ? (
            <p className="px-4 py-3 text-sm text-text-muted" role="status">
              Não foi possível buscar jogos. Tente novamente.
            </p>
          ) : searchState.status === 'success' && searchState.games.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">
              {normalizedQuery.length === 0
                ? 'Nenhum lançamento futuro encontrado.'
                : 'Nenhum jogo encontrado.'}
            </p>
          ) : searchState.status === 'success' ? (
            <ul aria-label="Resultados da busca" className="max-h-80 overflow-y-auto p-1.5">
              {searchState.games.map((game) => (
                <li key={game.id}>
                  <Link
                    aria-label={`Abrir detalhes de ${game.name}`}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                    onClick={() => setIsOpen(false)}
                    to={`/jogos/${game.id}`}
                  >
                    {game.coverUrl === null ? (
                      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-text-muted">
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
                      <span className="block truncate text-sm font-semibold text-content-primary">
                        {game.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-text-muted">
                        {gameMetadata(game)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
