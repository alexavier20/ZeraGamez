import { ArrowLeft, CalendarDays, Check, CircleCheck, Gamepad2, Star, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import {
  clearPendingAuthIntent,
  peekPendingAuthIntent,
  savePendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';
import {
  GameDetailsError,
  GameDetailsLoading,
  GameDetailsNotFound,
} from '@/features/games/components/GameDetailsStates';
import { useGameDetails } from '@/features/games/hooks/use-game-details';
import { isListsOperationCancelled, useLists } from '@/features/lists/context/ListsProvider';
import { DataError } from '@/shared/supabase/data-error';

import type { GameDetails } from '../../shared/contracts/game-details';

const releaseDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatGameReleaseDate(date: string | null) {
  return date === null
    ? 'Data não informada'
    : releaseDateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function formatScore(value: number | null) {
  return value === null ? 'Sem nota' : value.toFixed(0);
}

function InfoList({
  label,
  values,
}: {
  readonly label: string;
  readonly values: readonly string[];
}) {
  if (values.length === 0) return null;
  return (
    <div className="border-t border-white/10 py-4 first:border-t-0 first:pt-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</dt>
      <dd className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            className="rounded-md border border-white/10 bg-app/70 px-2.5 py-1 text-sm text-content-primary"
            key={value}
          >
            {value}
          </span>
        ))}
      </dd>
    </div>
  );
}

function GameHero({ game }: { readonly game: GameDetails }) {
  const heroImage = game.artworks[0] ?? game.screenshots[0];
  const { state: authState } = useAuth();
  const {
    getCompletedIds,
    loadWantToPlayIds,
    scopeVersion,
    setCompleted: saveCompleted,
    setWantToPlay,
    wantToPlayIds,
    wantToPlayMemberships,
  } = useLists();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState(false);
  const [completedStatus, setCompletedStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pendingListKey, setPendingListKey] = useState<'completed' | 'want_to_play' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const resumedIntentRef = useRef<string | null>(null);
  const gameSnapshot = useMemo(
    () => ({
      coverUrl: game.coverUrl,
      igdbId: game.id,
      name: game.name,
      releaseDate: game.firstReleaseDate,
    }),
    [game.coverUrl, game.firstReleaseDate, game.id, game.name],
  );
  const wantsToPlay = wantToPlayIds.has(game.id);
  const wantToPlayStatus = wantToPlayMemberships.get(game.id);

  useEffect(() => {
    if (authState.status !== 'authenticated') return;
    void loadWantToPlayIds([game.id]).catch((error: unknown) => {
      if (!isListsOperationCancelled(error)) {
        setActionError(
          error instanceof DataError ? error.message : 'Não foi possível carregar suas listas.',
        );
      }
    });
  }, [authState.status, game.id, loadWantToPlayIds, scopeVersion]);

  useEffect(() => {
    if (authState.status !== 'authenticated') {
      queueMicrotask(() => {
        setCompleted(false);
        setCompletedStatus('ready');
      });
      return;
    }

    const pendingIntent = peekPendingAuthIntent(sessionStorage);
    if (
      pendingIntent?.type === 'toggle-system-list' &&
      pendingIntent.systemKey === 'completed' &&
      pendingIntent.igdbId === game.id
    ) {
      return;
    }

    let active = true;
    queueMicrotask(() => {
      if (active) setCompletedStatus('loading');
    });
    void getCompletedIds([game.id])
      .then((completedIds) => {
        if (!active) return;
        setCompleted(completedIds.has(game.id));
        setCompletedStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || isListsOperationCancelled(error)) return;
        setCompletedStatus('error');
        setActionError(
          error instanceof DataError ? error.message : 'Não foi possível carregar suas listas.',
        );
      });

    return () => {
      active = false;
    };
  }, [authState.status, game.id, getCompletedIds, scopeVersion]);

  const runSystemListAction = useCallback(
    (systemKey: 'completed' | 'want_to_play', desired: boolean) => {
      setPendingListKey(systemKey);
      setActionError(null);
      const operation =
        systemKey === 'completed'
          ? saveCompleted(gameSnapshot, desired)
          : setWantToPlay(gameSnapshot, desired);
      void operation
        .then((confirmed) => {
          if (systemKey === 'completed') {
            setCompleted(confirmed);
            setCompletedStatus('ready');
          }
        })
        .catch((error: unknown) => {
          if (isListsOperationCancelled(error)) return;
          setActionError(
            error instanceof DataError ? error.message : 'Não foi possível atualizar sua lista.',
          );
        })
        .finally(() => {
          setPendingListKey(null);
        });
    },
    [gameSnapshot, saveCompleted, setWantToPlay],
  );

  useEffect(() => {
    if (authState.status !== 'authenticated') return;
    const pendingIntent = peekPendingAuthIntent(sessionStorage);
    if (
      pendingIntent?.type !== 'toggle-system-list' ||
      pendingIntent.igdbId !== game.id ||
      pendingIntent.returnTo !== `/jogos/${String(game.id)}`
    ) {
      return;
    }

    const intentKey = `${pendingIntent.systemKey}:${String(pendingIntent.igdbId)}`;
    if (resumedIntentRef.current === intentKey) return;
    resumedIntentRef.current = intentKey;
    clearPendingAuthIntent(sessionStorage);
    runSystemListAction(pendingIntent.systemKey, true);
  }, [authState.status, game.id, runSystemListAction]);

  const toggleSystemList = (systemKey: 'completed' | 'want_to_play') => {
    if (pendingListKey !== null) return;
    if (authState.status === 'anonymous') {
      savePendingAuthIntent(sessionStorage, {
        version: 1,
        type: 'toggle-system-list',
        returnTo: `/jogos/${String(game.id)}`,
        igdbId: game.id,
        systemKey,
      });
      void navigate('/entrar');
      return;
    }
    if (authState.status !== 'authenticated') return;

    if (systemKey === 'want_to_play') {
      if (wantToPlayStatus !== 'ready') return;
      runSystemListAction(systemKey, !wantsToPlay);
      return;
    }
    if (completedStatus !== 'ready') return;
    runSystemListAction(systemKey, !completed);
  };

  const actionDisabled =
    pendingListKey !== null || authState.status === 'loading' || authState.status === 'unavailable';
  const wantToPlayDisabled =
    actionDisabled || (authState.status === 'authenticated' && wantToPlayStatus !== 'ready');
  const completedDisabled =
    actionDisabled || (authState.status === 'authenticated' && completedStatus !== 'ready');

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-border-brand bg-surface shadow-[0_20px_64px_#00000040]">
      {heroImage ? (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          src={heroImage}
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-app via-app/95 to-app/65"
      />
      <div className="relative grid gap-7 p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8 sm:p-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:p-10">
        <div className="mx-auto w-40 sm:mx-0 sm:w-full">
          {game.coverUrl ? (
            <img
              alt={`Capa de ${game.name}`}
              className="aspect-[3/4] w-full rounded-2xl border border-white/10 object-cover shadow-[0_16px_40px_#00000080]"
              src={game.coverUrl}
            />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl border border-white/10 bg-bg-secondary text-text-muted">
              <Gamepad2 aria-hidden="true" size={40} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-center">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.22em] text-brand-bright">
            Detalhes do jogo
          </p>
          <h1 className="mt-2 break-words font-heading text-3xl font-bold leading-tight text-text-primary sm:text-4xl lg:text-5xl">
            {game.name}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-text-muted">
            <span className="inline-flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="text-brand-bright" size={16} />
              {formatGameReleaseDate(game.firstReleaseDate)}
            </span>
            <span
              className="inline-flex items-center gap-2"
              aria-label={`Nota IGDB: ${formatScore(game.rating)}`}
            >
              <Star aria-hidden="true" className="fill-brand-bright text-brand-bright" size={16} />
              <span className="font-semibold text-text-primary">{formatScore(game.rating)}</span>
              <span>IGDB</span>
              {game.ratingCount === null ? null : (
                <span>({game.ratingCount.toLocaleString('pt-BR')} avaliações)</span>
              )}
            </span>
          </div>

          {game.genres.length === 0 ? null : (
            <ul aria-label="Gêneros" className="mt-5 flex flex-wrap gap-2">
              {game.genres.map((genre) => (
                <li
                  className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-xs font-semibold text-filter-active-text"
                  key={genre}
                >
                  {genre}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3">
            {game.videos[0] ? (
              <a
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-app/70 px-4 text-sm font-semibold text-content-primary transition-colors hover:border-white/40 hover:bg-app focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                href={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(game.videos[0].videoId)}`}
                rel="noreferrer"
                target="_blank"
              >
                Assistir trailer
              </a>
            ) : null}
            <button
              aria-label={
                wantsToPlay ? 'Remover da lista Quero Jogar!' : 'Adicionar à lista Quero Jogar!'
              }
              aria-pressed={wantsToPlay}
              disabled={wantToPlayDisabled}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 ${
                wantsToPlay
                  ? 'bg-[#118c45] ring-2 ring-inset ring-white/80 shadow-[0_0_0_2px_#ffffff66]'
                  : 'bg-[#16c765] hover:bg-[#13b85b]'
              }`}
              onClick={() => {
                toggleSystemList('want_to_play');
              }}
              type="button"
            >
              {wantsToPlay ? (
                <Check aria-hidden="true" size={19} />
              ) : (
                <CircleCheck aria-hidden="true" size={19} />
              )}
              {wantsToPlay ? 'Na lista' : 'Quero jogar!'}
            </button>
            <button
              aria-label={completed ? 'Remover da lista Já Zerei' : 'Adicionar à lista Já Zerei'}
              aria-pressed={completed}
              disabled={completedDisabled}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 ${
                completed
                  ? 'bg-[#118c45] ring-2 ring-inset ring-white/80 shadow-[0_0_0_2px_#ffffff66]'
                  : 'bg-[#16c765] hover:bg-[#13b85b]'
              }`}
              onClick={() => {
                toggleSystemList('completed');
              }}
              type="button"
            >
              {completed ? (
                <Check aria-hidden="true" size={19} />
              ) : (
                <Trophy aria-hidden="true" size={19} />
              )}
              {completed ? 'Jogo zerado' : 'Já zerei!'}
            </button>
          </div>
          {actionError === null ? null : (
            <p className="mt-3 text-sm text-red-200" role="alert">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function GameGallery({ game }: { readonly game: GameDetails }) {
  const images = game.screenshots.length > 0 ? game.screenshots : game.artworks;
  if (images.length === 0) return null;
  const visibleImages = images.slice(0, 6);

  return (
    <section aria-labelledby="game-gallery-heading" className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-bright">
            Imagens
          </p>
          <h2
            className="mt-1 font-heading text-2xl font-bold text-text-primary"
            id="game-gallery-heading"
          >
            Galeria
          </h2>
        </div>
        <span className="text-xs text-text-muted">{visibleImages.length} imagens</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleImages.map((image, index) => (
          <img
            alt={`${game.name} — imagem ${String(index + 1)}`}
            className="aspect-video w-full rounded-xl border border-white/10 bg-surface object-cover"
            key={image}
            loading="lazy"
            src={image}
          />
        ))}
      </div>
    </section>
  );
}

function GameDetailsContent({ game }: { readonly game: GameDetails }) {
  return (
    <main
      aria-label={`Detalhes de ${game.name}`}
      className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pb-12 sm:pt-7 lg:px-8 lg:pt-9"
    >
      <Link
        className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-text-muted transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        to="/lancamentos"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Voltar para lançamentos
      </Link>

      <GameHero game={game} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)] lg:gap-14">
        <div className="min-w-0">
          {game.summary || game.storyline ? (
            <section aria-labelledby="game-about-heading">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-bright">
                Sobre o jogo
              </p>
              <h2
                className="mt-1 font-heading text-2xl font-bold text-text-primary"
                id="game-about-heading"
              >
                {game.name}
              </h2>
              {game.summary ? (
                <p className="mt-4 whitespace-pre-line text-base leading-7 text-content-primary">
                  {game.summary}
                </p>
              ) : null}
              {game.storyline ? (
                <div className="mt-6 border-l-2 border-brand pl-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                    História
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-muted">
                    {game.storyline}
                  </p>
                </div>
              ) : null}
            </section>
          ) : (
            <section aria-labelledby="game-about-heading">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-bright">
                Sobre o jogo
              </p>
              <h2
                className="mt-1 font-heading text-2xl font-bold text-text-primary"
                id="game-about-heading"
              >
                {game.name}
              </h2>
              <p className="mt-4 text-sm text-text-muted">
                Ainda não há uma descrição cadastrada para este jogo.
              </p>
            </section>
          )}

          <GameGallery game={game} />
        </div>

        <aside aria-labelledby="game-information-heading">
          <div className="border-t-2 border-brand pt-4">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-bright">
              Ficha do jogo
            </p>
            <h2
              className="mt-1 font-heading text-2xl font-bold text-text-primary"
              id="game-information-heading"
            >
              Informações
            </h2>
          </div>
          <dl className="mt-5">
            <InfoList label="Plataformas" values={game.platforms} />
            <InfoList label="Desenvolvido por" values={game.developers} />
            <InfoList label="Publicado por" values={game.publishers} />
            <InfoList label="Modos de jogo" values={game.gameModes} />
            <InfoList label="Perspectiva" values={game.playerPerspectives} />
            {game.criticRating === null ? null : (
              <div className="border-t border-white/10 py-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Nota da crítica
                </dt>
                <dd className="mt-2 flex items-baseline gap-2">
                  <span className="font-heading text-2xl font-bold text-text-primary">
                    {formatScore(game.criticRating)}
                  </span>
                  <span className="text-xs text-text-muted">
                    {game.criticRatingCount === null
                      ? 'IGDB'
                      : `IGDB · ${game.criticRatingCount.toLocaleString('pt-BR')} avaliações`}
                  </span>
                </dd>
              </div>
            )}
            {game.ageRatings.length === 0 ? null : (
              <div className="border-t border-white/10 py-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Classificação indicativa
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {game.ageRatings.map(({ organization, rating }) => (
                    <span
                      className="rounded-md border border-white/10 bg-surface px-2.5 py-1 text-sm text-content-primary"
                      key={`${organization}-${rating}`}
                    >
                      {organization}: {rating}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </main>
  );
}

export function GameDetailsPage() {
  const { gameId: rawGameId } = useParams();
  const parsedId = rawGameId !== undefined && /^\d+$/.test(rawGameId) ? Number(rawGameId) : NaN;
  const id = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const { retry, state } = useGameDetails(id);

  if (state.status === 'loading') return <GameDetailsLoading />;
  if (state.status === 'error') return <GameDetailsError onRetry={retry} />;
  if (state.status === 'not-found') return <GameDetailsNotFound />;
  return <GameDetailsContent game={state.game} />;
}
