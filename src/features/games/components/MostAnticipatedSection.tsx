import { ArrowRight, Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { getMostAnticipatedGames } from '@/features/games/api/game-search-client';
import { getReleaseCountdown } from '@/features/games/model/release-countdown';
import { headerRoutes } from '@/shared/components/header/header.config';
import { DiagonalSwipeButton } from '@/shared/components/DiagonalSwipeButton';
import { HomeSectionHeading } from '@/shared/components/HomeSectionHeading';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';

type SectionState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'success'; readonly games: readonly GameSearchResult[] };

const skeletons = [0, 1, 2] as const;
const releaseDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
function formatReleaseDate(value: string): string {
  return releaseDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function remainingDaysLabel(days: number): string {
  return `Faltam ${String(days)} ${days === 1 ? 'dia' : 'dias'}`;
}

function GameArtwork({
  className,
  game,
}: Readonly<{ className: string; game: GameSearchResult }>) {
  return (
    <div aria-hidden="true" className={`overflow-hidden bg-bg-secondary ${className}`}>
      {game.coverUrl ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-105"
          loading="lazy"
          src={game.coverUrl}
        />
      ) : (
        <span className="absolute inset-0 grid size-full place-items-center">
          <Gamepad2 className="size-16 text-icon/30" />
        </span>
      )}
    </div>
  );
}

function FeaturedAnticipatedGameCard({
  game,
  now,
}: Readonly<{ game: GameSearchResult; now: number }>) {
  if (game.releaseDate === null) return null;

  const countdown = getReleaseCountdown(game.releaseDate, now);

  return (
    <Link
      className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden border border-border bg-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-bright sm:min-h-[420px] lg:min-h-[480px]"
      to={`/jogos/${String(game.id)}`}
    >
      <GameArtwork className="absolute inset-0" game={game} />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/5"
      />
      <div className="relative flex flex-col items-start p-5 sm:p-7">
        <span className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-brand-ink">
          {formatReleaseDate(game.releaseDate)}
        </span>
        <h3 className="mt-3 line-clamp-3 font-heading text-2xl leading-tight font-semibold text-white sm:text-3xl">
          {game.name}
        </h3>
        <span className="mt-2 text-sm font-medium text-white/90">
          {remainingDaysLabel(countdown.days)}
        </span>
      </div>
    </Link>
  );
}

function CompactAnticipatedGameCard({
  game,
  now,
}: Readonly<{ game: GameSearchResult; now: number }>) {
  if (game.releaseDate === null) return null;

  const countdown = getReleaseCountdown(game.releaseDate, now);

  return (
    <Link
      className="group grid min-h-[140px] grid-cols-[36%_minmax(0,1fr)] overflow-hidden border border-border bg-bg-secondary transition-colors duration-150 hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-bright"
      to={`/jogos/${String(game.id)}`}
    >
      <GameArtwork className="relative min-h-[140px]" game={game} />
      <div className="flex min-w-0 flex-col items-start justify-center p-3 sm:p-4">
        <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-brand-ink">
          {formatReleaseDate(game.releaseDate)}
        </span>
        <h3 className="mt-2 line-clamp-2 font-heading text-base leading-tight font-semibold text-content-primary sm:text-lg">
          {game.name}
        </h3>
        <span className="mt-2 text-xs font-medium text-text-muted">
          {remainingDaysLabel(countdown.days)}
        </span>
      </div>
    </Link>
  );
}

export function MostAnticipatedSection() {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<SectionState>({ status: 'loading' });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void getMostAnticipatedGames({ signal: controller.signal })
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

  const games =
    state.status === 'success'
      ? state.games
          .filter((game) => game.releaseDate)
          .slice(0, 6)
          .sort((left, right) => (left.releaseDate ?? '').localeCompare(right.releaseDate ?? ''))
      : [];

  return (
    <section aria-labelledby="most-anticipated-title" className="pt-10 sm:pt-14">
      <HomeSectionHeading
        action={
          <DiagonalSwipeButton size="compact" to={headerRoutes.hype}>
            Ver mais
            <ArrowRight aria-hidden="true" size={18} strokeWidth={1.5} />
          </DiagonalSwipeButton>
        }
        id="most-anticipated-title"
        title="Mais hypados"
      />

      {state.status === 'loading' ? (
        <div
          aria-label="Carregando jogos mais hypados"
          className="grid gap-4 lg:grid-cols-2 lg:gap-5"
          role="status"
        >
          <div
            aria-hidden="true"
            className="min-h-[360px] animate-pulse bg-brand-bright/20 motion-reduce:animate-none sm:min-h-[420px] lg:min-h-[480px]"
          />
          <div className="grid gap-4 lg:grid-rows-3">
            {skeletons.map((index) => (
              <div
                aria-hidden="true"
                className="grid min-h-[140px] animate-pulse grid-cols-[36%_minmax(0,1fr)] overflow-hidden bg-brand-bright/20 motion-reduce:animate-none"
                key={index}
              >
                <div className="bg-brand-bright/20" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-2/5 rounded bg-surface/70" />
                  <div className="h-5 w-4/5 rounded bg-surface/70" />
                  <div className="h-4 w-1/2 rounded bg-surface/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : state.status === 'error' ? (
        <div
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-7 text-center"
          role="alert"
        >
          <p className="text-sm text-red-700">Não foi possível carregar os jogos mais hypados.</p>
          <button
            className="mt-3 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-800/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
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
          className="rounded-xl border border-dashed border-border bg-surface px-5 py-7 text-center text-sm text-text-muted"
          role="status"
        >
          Ainda não há jogos futuros com hype registrado.
        </p>
      ) : (
        <div className={`grid gap-4 lg:gap-5 ${games.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {games[0] ? <FeaturedAnticipatedGameCard game={games[0]} now={now} /> : null}
          {games.length > 1 ? (
            <ul className="grid list-none gap-4 p-0 lg:auto-rows-fr">
              {games.slice(1, 4).map((game) => (
                <li key={game.id}>
                  <CompactAnticipatedGameCard game={game} now={now} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
