import { ArrowRight, Flame, Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { getMostAnticipatedGames } from '@/features/games/api/game-search-client';
import { getReleaseCountdown } from '@/features/games/model/release-countdown';
import { headerRoutes } from '@/shared/components/header/header.config';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';

type SectionState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'success'; readonly games: readonly GameSearchResult[] };

const skeletons = [0, 1, 2, 3, 4, 5] as const;
const releaseDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const hypeCountFormatter = new Intl.NumberFormat('pt-BR');

function formatReleaseDate(value: string): string {
  return releaseDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function AnticipatedGameCard({ game, now }: Readonly<{ game: GameSearchResult; now: number }>) {
  if (game.releaseDate === null) return null;

  const countdown = getReleaseCountdown(game.releaseDate, now);
  const daysUnit = countdown.days === 1 ? 'dia' : 'dias';
  const remainingDaysLabel = `Faltam ${String(countdown.days)} ${daysUnit}`;

  return (
    <li>
      <Link
        aria-label={`Abrir ${game.name}. ${remainingDaysLabel} para o lançamento.`}
        className="group relative flex min-h-[176px] flex-col justify-between overflow-hidden rounded-lg border border-border bg-surface p-4 transition-colors duration-150 hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        to={`/jogos/${String(game.id)}`}
      >
        {game.coverUrl ? (
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            src={game.coverUrl}
          />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
            <Gamepad2 className="size-24 text-brand/20" />
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-text-primary/90 via-text-primary/75 to-text-primary/25"
        />

        <span className="relative block max-w-[90%]">
          <span className="block line-clamp-2 font-heading text-base font-semibold leading-tight text-white">
            {game.name}
          </span>
          <span className="mt-1 block text-xs font-medium text-white/90">
            {formatReleaseDate(game.releaseDate)}
          </span>
          {game.hypeCount !== undefined && (
            <span
              aria-label={`${hypeCountFormatter.format(game.hypeCount)} hypes registrados na IGDB`}
              className="mt-2 inline-flex w-fit items-center gap-1 rounded-md border border-border bg-text-primary/55 px-2 py-1 text-[11px] font-medium tabular-nums text-white/90"
            >
              <Flame aria-hidden="true" size={14} strokeWidth={1.75} />
              {hypeCountFormatter.format(game.hypeCount)} hypes
            </span>
          )}
        </span>

        <span className="relative mt-5 block">
          <span aria-hidden="true" className="mx-auto grid w-fit grid-cols-1">
            <span className="grid h-11 min-w-[72px] place-content-center justify-items-center gap-1 rounded-md border border-border bg-text-primary/45 px-2 text-center">
              <span className="block font-heading text-sm font-semibold leading-none tabular-nums text-white">
                {String(countdown.days).padStart(2, '0')}
              </span>
              <span className="block text-[11px] leading-none text-white/70">
                {daysUnit === 'dia' ? 'Dia' : 'Dias'}
              </span>
            </span>
          </span>
        </span>
      </Link>
    </li>
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
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2
            className="flex items-center gap-2 font-heading text-xl font-semibold text-text-primary sm:text-2xl"
            id="most-anticipated-title"
          >
            <span aria-hidden="true" className="h-6 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-brand" />
            Mais hypados
          </h2>
        </div>
        <Link
          className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-brand-hover hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to={headerRoutes.hype}
        >
          Ver mais
          <ArrowRight aria-hidden="true" size={18} strokeWidth={1.5} />
        </Link>
      </div>

      {state.status === 'loading' ? (
        <ul
          aria-label="Carregando jogos mais hypados"
          className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3"
          role="status"
        >
          {skeletons.map((index) => (
            <li
              aria-hidden="true"
              className="flex min-h-[176px] animate-pulse flex-col justify-between rounded-lg border border-border bg-surface p-4 motion-reduce:animate-none"
              key={index}
            >
              <div>
                <div className="h-5 w-3/4 rounded bg-brand-bright/20" />
                <div className="mt-1 h-4 w-1/2 rounded bg-brand-bright/20" />
              </div>
              <div className="mx-auto mt-5 grid w-full max-w-[216px] grid-cols-3 gap-1">
                {[0, 1, 2].map((unit) => (
                  <div
                    className="grid h-11 place-content-center justify-items-center gap-1 rounded-md border border-border bg-text-primary/20"
                    key={unit}
                  >
                    <div className="h-3.5 w-5 rounded bg-brand-bright/20" />
                    <div className="h-2 w-7 rounded bg-brand-bright/20" />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : state.status === 'error' ? (
        <div
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-7 text-center"
          role="alert"
        >
          <p className="text-sm text-red-700">Não foi possível carregar os jogos mais hypados.</p>
          <button
            className="mt-3 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
        <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <AnticipatedGameCard game={game} key={game.id} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
