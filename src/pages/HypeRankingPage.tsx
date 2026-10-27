import { Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { getTopHypedGames } from '@/features/games/api/game-search-client';
import { MyHypesSection } from '@/features/games/components/MyHypesSection';
import { formatReleaseDate } from '@/features/releases/model/release-presentation';
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
        const rankToneClassName = isPodium
          ? 'animate-pulse text-amber-300 drop-shadow-[0_0_8px_#facc15] motion-reduce:animate-none'
          : 'text-brand-bright';
        const releaseDate = game.releaseDate
          ? formatReleaseDate(game.releaseDate)
          : 'Data indisponível';

        return (
          <li key={game.id}>
            <Link
              aria-label={`${String(rank)}º lugar: ${game.name}. Lançamento: ${releaseDate}`}
              className="group flex min-h-[60px] min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-transparent p-2 transition hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:gap-3"
              to={`/jogos/${String(game.id)}`}
            >
              <span
                aria-hidden="true"
                className={`w-8 shrink-0 text-center font-heading text-2xl font-bold tabular-nums sm:w-10 sm:text-3xl ${rankToneClassName}`}
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
                  <Gamepad2 size={22} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-semibold leading-tight text-content-primary transition-colors group-hover:text-white sm:text-base">
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
    setState({ status: 'loading' });

    void getTopHypedGames({ signal: controller.signal })
      .then((games) => {
        if (!controller.signal.aborted) setState({ status: 'success', games });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });

    return () => controller.abort();
  }, [retryKey]);

  const games = state.status === 'success' ? state.games.slice(0, 10) : [];

  return (
    <main className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pb-28 pt-7 sm:px-5 sm:pb-12 lg:px-8 lg:pt-9">
      <PageHeading subtitle="Top 10 Hypados" title="Tô no Hype" />

      <section aria-label="Ranking dos jogos mais hypados" className="mt-8">
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
                      className="h-[60px] animate-pulse rounded-xl bg-surface"
                      key={item}
                    />
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
            <p className="text-sm text-red-100">Não foi possível carregar o ranking agora.</p>
            <button
              className="mt-4 rounded-xl border border-red-200/30 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => setRetryKey((value) => value + 1)}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : games.length === 0 ? (
          <p
            className="rounded-2xl border border-dashed border-white/15 bg-surface px-5 py-8 text-center text-sm text-text-muted"
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
