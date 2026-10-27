import { Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { getMostAnticipatedGames } from '@/features/games/api/game-search-client';
import { todayInSaoPaulo } from '@/features/releases/model/release-calendar';

import type { GameSearchResult } from '../../../../shared/contracts/game-search';

type SectionState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'success'; readonly games: readonly GameSearchResult[] };

const skeletons = [0, 1, 2, 3, 4, 5] as const;
const DAY_MS = 86_400_000;

const releaseDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatReleaseDate(value: string): string {
  return releaseDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function daysUntilRelease(releaseDate: string, today: string): number {
  const releaseDay = Date.parse(`${releaseDate}T00:00:00.000Z`);
  const currentDay = Date.parse(`${today}T00:00:00.000Z`);
  return Math.max(0, Math.round((releaseDay - currentDay) / DAY_MS));
}

function AnticipatedGameCard({ game, today }: Readonly<{ game: GameSearchResult; today: string }>) {
  if (game.releaseDate === null) return null;

  const days = daysUntilRelease(game.releaseDate, today);

  return (
    <li>
      <Link
        aria-label={`Abrir ${game.name}. Faltam ${String(days)} dias para o lançamento.`}
        className="group relative flex min-h-[204px] flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-surface p-4 shadow-[0_10px_28px_#00000050] transition hover:-translate-y-0.5 hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-[220px] sm:p-5"
        to={`/jogos/${String(game.id)}`}
      >
        {game.coverUrl ? (
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            src={game.coverUrl}
          />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
            <Gamepad2 className="size-24 text-white/10" />
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/25"
        />

        <span className="relative block max-w-[90%]">
          <span className="block line-clamp-2 font-heading text-lg font-bold leading-tight text-white sm:text-xl">
            {game.name}
          </span>
          <span className="mt-1 block text-sm font-medium text-white/90 underline decoration-white/50 underline-offset-2">
            {formatReleaseDate(game.releaseDate)}
          </span>
        </span>

        <span className="relative mt-5 block">
          <span aria-hidden="true" className="flex flex-wrap gap-1.5">
            {String(days)
              .padStart(2, '0')
              .split('')
              .map((digit, index) => (
                <span
                  className="grid size-10 place-items-center rounded-md border border-white/10 bg-black/45 font-heading text-2xl font-semibold tabular-nums text-white shadow-inner sm:size-12 sm:text-3xl"
                  key={`${String(index)}-${digit}`}
                >
                  {digit}
                </span>
              ))}
          </span>
          <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
            Faltam {String(days)} {days === 1 ? 'dia' : 'dias'}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function MostAnticipatedSection() {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<SectionState>({ status: 'loading' });
  const today = todayInSaoPaulo();

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    void getMostAnticipatedGames({ signal: controller.signal })
      .then((games) => {
        if (!controller.signal.aborted) setState({ status: 'success', games });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });

    return () => controller.abort();
  }, [retryKey]);

  const games =
    state.status === 'success'
      ? state.games
          .filter((game) => game.releaseDate)
          .slice(0, 6)
          .sort((left, right) =>
            (left.releaseDate ?? '').localeCompare(right.releaseDate ?? ''),
          )
      : [];

  return (
    <section aria-labelledby="most-anticipated-title" className="pt-10 sm:pt-12">
      <div className="mb-5 flex items-end justify-between sm:mb-6">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-bright">
            No radar da comunidade
          </p>
          <h2
            className="mt-1 font-heading text-2xl font-bold text-text-primary sm:text-3xl"
            id="most-anticipated-title"
          >
            Mais Hypados
          </h2>
        </div>
      </div>

      {state.status === 'loading' ? (
        <ul
          aria-label="Carregando jogos mais hypados"
          className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3"
          role="status"
        >
          {skeletons.map((index) => (
            <li
              aria-hidden="true"
              className="min-h-[204px] animate-pulse rounded-xl bg-surface sm:min-h-[220px]"
              key={index}
            />
          ))}
        </ul>
      ) : state.status === 'error' ? (
        <div
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-7 text-center"
          role="alert"
        >
          <p className="text-sm text-red-100">Não foi possível carregar os jogos mais hypados.</p>
          <button
            className="mt-3 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => setRetryKey((value) => value + 1)}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : games.length === 0 ? (
        <p
          className="rounded-xl border border-dashed border-white/15 bg-surface px-5 py-7 text-center text-sm text-text-muted"
          role="status"
        >
          Ainda não há jogos futuros com hype registrado.
        </p>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <AnticipatedGameCard game={game} key={game.id} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}
