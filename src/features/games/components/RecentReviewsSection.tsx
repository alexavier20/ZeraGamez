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
      <p className="text-xs font-medium text-text-muted">Já disponíveis</p>
      <h2
        id="recent-reviews-title"
        className="mt-1 mb-6 font-heading text-xl font-semibold text-text-primary sm:text-2xl"
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
              score >= 75 ? 'bg-[#4cc38a]' : score >= 50 ? 'bg-[#e2b75d]' : 'bg-[#e8797e]';
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
                      className="aspect-[2/3] w-full rounded-lg object-cover transition-opacity duration-150 group-hover:opacity-90"
                    />
                  ) : (
                    <div className="aspect-[2/3] rounded-lg bg-surface" />
                  )}
                  <h3
                    title={game.name}
                    className="mt-3 truncate text-sm font-medium text-text-primary transition-colors duration-150 group-hover:text-white"
                  >
                    {game.name}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      aria-label={'Nota da crítica: ' + String(score) + ' de 100'}
                      className={'rounded-sm px-1.5 py-1 text-xs font-semibold tabular-nums text-black ' + color}
                    >
                      {score}
                    </span>
                    <span className="text-[11px] leading-4 text-text-muted">{label}</span>
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
