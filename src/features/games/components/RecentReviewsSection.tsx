import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { HomeCarouselSkeleton } from '@/shared/components/HomeCarouselSkeleton';
import { HorizontalGameCarousel } from '@/shared/components/HorizontalGameCarousel';

import { getRecentReviewedGames } from '../api/game-search-client';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';

export function RecentReviewsSection() {
  const [games, setGames] = useState<readonly GameSearchResult[]>([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getRecentReviewedGames({ signal: controller.signal })
      .then((data) => {
        setGames(data);
        setStatus('success');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => {
      controller.abort();
    };
  }, [attempt]);
  return (
    <section aria-labelledby="recent-reviews-title" className="pt-10 sm:pt-14">
      <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-bright">
        Já disponíveis
      </p>
      <h2
        id="recent-reviews-title"
        className="mt-1 mb-6 font-heading text-xl font-bold text-text-primary sm:text-2xl"
      >
        Últimos lançamentos avaliados
      </h2>
      {status === 'loading' ? (
        <HomeCarouselSkeleton variant="reviews" />
      ) : status === 'error' ? (
        <div role="alert" className="text-text-muted">
          Não foi possível carregar as avaliações.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setStatus('loading');
              setAttempt((value) => value + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : games.length === 0 ? (
        <p className="text-text-muted">Nenhum lançamento avaliado disponível.</p>
      ) : (
        <HorizontalGameCarousel
          label="Jogos por lançamento mais recente, role para ver mais jogos"
          previousLabel="Ver avaliações anteriores"
          nextLabel="Ver próximas avaliações"
        >
          {games.map((game) => {
            const score = Math.round(game.criticScore ?? 0);
            const color =
              score >= 75 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
            const label =
              score >= 75
                ? 'Críticas favoráveis'
                : score >= 50
                  ? 'Críticas mistas'
                  : 'Críticas desfavoráveis';
            return (
              <li key={game.id} className="w-40 shrink-0 snap-start sm:w-44">
                <Link
                  to={'/jogos/' + String(game.id)}
                  className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                >
                  {game.coverUrl ? (
                    <img
                      src={game.coverUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-[2/3] w-full rounded-lg object-cover transition group-hover:opacity-85"
                    />
                  ) : (
                    <div className="aspect-[2/3] rounded-lg bg-surface" />
                  )}
                  <h3
                    title={game.name}
                    className="mt-3 truncate text-sm font-bold text-text-primary underline decoration-white/25 underline-offset-4"
                  >
                    {game.name}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      aria-label={'Nota da crítica: ' + String(score) + ' de 100'}
                      className={'rounded-sm px-1.5 py-1 text-xs font-bold text-black ' + color}
                    >
                      {score}
                    </span>
                    <span className="text-[10px] text-text-muted">{label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </HorizontalGameCarousel>
      )}
    </section>
  );
}
