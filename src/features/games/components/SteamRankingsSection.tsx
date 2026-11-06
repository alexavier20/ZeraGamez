import { ArrowUpRight, Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { getSteamRanking } from '@/features/games/api/game-search-client';

import {
  steamRankingLabels,
  type SteamRankingMetric,
} from '../../../../shared/contracts/steam-rankings';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';

const rankings = [
  { metric: 'peak-players', description: 'Maior pico de jogadores em 24 horas' },
  { metric: 'positive-reviews', description: 'Destaques em avaliações positivas' },
  { metric: 'top-sellers', description: 'Líderes globais de vendas' },
] as const;

type RankingState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; games: readonly GameSearchResult[] };

function SteamRankingCard({
  metric,
  description,
}: Readonly<{ metric: SteamRankingMetric; description: string }>) {
  const [state, setState] = useState<RankingState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void getSteamRanking(metric, { signal: controller.signal })
      .then((games) => {
        if (!controller.signal.aborted) setState({ status: 'success', games });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => {
      controller.abort();
    };
  }, [metric, attempt]);

  return (
    <section
      aria-labelledby={`steam-${metric}`}
      className="overflow-hidden rounded-xl border border-white/10 bg-bg-secondary"
    >
      <div className="border-b border-white/10 px-4 py-5">
        <p className="mb-2 text-xs font-medium text-text-muted">Top 5 · Steam</p>
        <h3
          className="font-heading text-base font-semibold text-content-primary"
          id={`steam-${metric}`}
        >
          {steamRankingLabels[metric]}
        </h3>
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      </div>
      {state.status === 'loading' ? (
        <div
          aria-label={`Carregando ${steamRankingLabels[metric]}`}
          role="status"
          className="divide-y divide-white/5 px-3"
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              aria-hidden="true"
              className="flex min-h-20 animate-pulse items-center gap-3 px-1 py-3 motion-reduce:animate-none"
              key={index}
            >
              <div className="h-5 w-5 shrink-0 rounded bg-white/10" />
              <div className="h-14 w-10 shrink-0 rounded bg-white/10" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-4/5 rounded bg-white/10" />
                <div className="h-3.5 w-1/2 rounded bg-white/10" />
              </div>
              <div className="size-4 shrink-0 rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : state.status === 'error' ? (
        <div className="px-4 py-8 text-center" role="alert">
          <p className="text-sm text-text-muted">Não foi possível carregar este ranking.</p>
          <button
            className="mt-4 min-h-11 rounded-lg border border-white/15 px-4 text-xs font-medium text-content-primary hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : state.games.length === 0 ? (
        <p className="px-4 py-8 text-sm text-text-muted">Nenhum jogo disponível neste ranking.</p>
      ) : (
        <ol className="divide-y divide-white/5 px-3">
          {state.games.map((game, index) => (
            <li key={game.id}>
              <Link
                className="group flex min-h-20 items-center gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand"
                to={`/jogos/${String(game.id)}`}
              >
                <span
                  className={`w-5 shrink-0 text-center font-heading text-lg font-semibold tabular-nums ${index === 0 ? 'text-brand-bright' : 'text-text-muted'}`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {game.coverUrl ? (
                  <img
                    alt=""
                    className="h-14 w-10 shrink-0 rounded object-cover"
                    loading="lazy"
                    src={game.coverUrl}
                  />
                ) : (
                  <span className="grid h-14 w-10 shrink-0 place-items-center rounded bg-surface text-text-muted">
                    <Gamepad2 aria-hidden="true" size={18} strokeWidth={1.5} />
                  </span>
                )}
                <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold text-content-primary">
                  {game.name}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="shrink-0 text-text-muted transition-colors group-hover:text-brand-bright"
                  size={18}
                  strokeWidth={1.5}
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function SteamRankingsSection() {
  return (
    <section aria-labelledby="steam-rankings-title" className="pt-10 sm:pt-14">
      <div className="mb-6">
        <p className="text-xs font-medium text-text-muted">Em alta no PC</p>
        <h2
          className="mt-1 flex items-center gap-2 font-heading text-xl font-semibold text-content-primary sm:text-2xl"
          id="steam-rankings-title"
        >
          Rankings Steam
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {rankings.map((ranking) => (
          <SteamRankingCard key={ranking.metric} {...ranking} />
        ))}
      </div>
    </section>
  );
}
