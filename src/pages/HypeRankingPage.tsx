import { Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { getTopHypedGames } from '@/features/games/api/game-search-client';
import { MyHypesSection } from '@/features/games/components/MyHypesSection';
import { formatReleaseDate } from '@/features/releases/model/release-presentation';
import { Skeleton } from '@/shared/components/LoadingSkeletons';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

import type { GameSearchResult } from '../../shared/contracts/game-search';

type RankingState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'success'; readonly games: readonly GameSearchResult[] };

const rankingSkeletons = Array.from({ length: 10 }, (_, index) => index);

function RankingList({
  games,
  start,
}: Readonly<{ games: readonly GameSearchResult[]; start: number }>) {
  return (
    <ol
      aria-label={`Posições ${String(start)} a ${String(start + 4)}`}
      className="m-0 list-none space-y-3 p-0"
      start={start}
    >
      {games.map((game, index) => {
        const rank = start + index;
        const isPodium = rank <= 3;
        const rankToneClassName = isPodium ? 'text-brand' : 'text-text-muted';
        const releaseDate = game.releaseDate
          ? formatReleaseDate(game.releaseDate)
          : 'Data indisponível';

        return (
          <li key={game.id}>
            <Link
              aria-label={`${String(rank)}º lugar: ${game.name}. Lançamento: ${releaseDate}`}
       className="group flex min-h-[60px] min-w-0 items-center gap-2 rounded-xl border border-border bg-transparent p-2 transition-colors duration-150 hover:border-border hover:bg-brand-bright hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:gap-3"
              to={`/jogos/${String(game.id)}`}
            >
              <span
                aria-hidden="true"
                className={`w-8 shrink-0 text-center font-heading text-2xl font-semibold tabular-nums sm:w-10 sm:text-3xl ${rankToneClassName}`}
              >
                {rank}
              </span>
              {game.coverUrl ? (
                <img
                  alt=""
                  className="size-10 shrink-0 rounded-lg bg-bg-secondary object-cover sm:size-12"
                  loading="lazy"
                  src={game.coverUrl}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-bg-secondary text-text-muted sm:size-12"
                >
                  <Gamepad2 aria-hidden="true" size={18} strokeWidth={1.5} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span
                  title={game.name}
                  className="line-clamp-1 text-sm font-semibold leading-tight text-content-primary transition-colors group-hover:text-brand sm:text-base"
                >
                  {game.name}
                </span>
                <span className="mt-0.5 block truncate text-xs leading-4 text-text-muted">
                  {releaseDate}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function HypeRankingPage() {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<RankingState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    void getTopHypedGames({ signal: controller.signal })
      .then((games) => {
        if (!controller.signal.aborted) setState({ status: 'success', games });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });

    return () => {
      controller.abort();
    };
  }, [retryKey]);

  const games = state.status === 'success' ? state.games.slice(0, 10) : [];

  return (
    <main className="site-container min-h-[calc(100dvh-3.5rem)] pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7">
      <PageHeading
        subtitle="Os 10 jogos mais aguardados"
        title="Tô no Hype"
        titleClassName="font-heading text-2xl leading-tight font-semibold text-content-primary sm:text-[28px] lg:text-[32px]"
      />

      <section aria-label="Ranking dos jogos mais hypados" className="mt-6">
        {state.status === 'loading' ? (
          <div
            aria-label="Carregando ranking dos jogos mais hypados"
            className="grid gap-3 lg:grid-cols-2 lg:gap-5"
            role="status"
          >
            {[rankingSkeletons.slice(0, 5), rankingSkeletons.slice(5)].map(
              (column, columnIndex) => (
                <ol className="m-0 list-none space-y-3 p-0" key={columnIndex}>
                  {column.map((item) => (
                    <li
                      aria-hidden="true"
                      className="flex min-h-[60px] items-center gap-2 rounded-xl border border-border p-2 sm:gap-3"
                      key={item}
                    >
                      <Skeleton className="h-8 w-8 shrink-0 sm:w-10" />
                      <Skeleton className="size-10 shrink-0 rounded-lg sm:size-12" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </li>
                  ))}
                </ol>
              ),
            )}
          </div>
        ) : state.status === 'error' ? (
          <div
            className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center"
            role="alert"
          >
            <p className="text-sm text-red-700">Não foi possível carregar o ranking agora.</p>
            <button
              className="mt-4 min-h-11 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-semibold text-red-700 transition-colors duration-150 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              onClick={() => {
                setState({ status: 'loading' });
                setRetryKey((value) => value + 1);
              }}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : games.length === 0 ? (
          <p
            className="rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-text-muted"
            role="status"
          >
            Ainda não há jogos futuros com hype registrado.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
            <RankingList games={games.slice(0, 5)} start={1} />
            <RankingList games={games.slice(5, 10)} start={6} />
          </div>
        )}
      </section>

      <MyHypesSection />
    </main>
  );
}
