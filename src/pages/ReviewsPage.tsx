import { ArrowLeft, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { searchGames } from '@/features/games/api/game-search-client';
import { LoadingPreview, ReviewsLoading, Skeleton } from '@/shared/components/LoadingSkeletons';
import { getSupabaseClient } from '@/shared/supabase/client';

import type { GameSearchResult } from '../../shared/contracts/game-search';

interface Review {
  igdb_id: number;
  name: string;
  cover_url: string | null;
  score: number;
  analysis: string | null;
  is_public: boolean;
  updated_at: string;
}
const field =
  'min-h-11 w-full rounded-lg border border-border bg-bg-secondary p-3 text-sm text-content-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-border focus:ring-2 focus:ring-brand/30';
const searchPageSize = 8;

function scoreColor(score: number): string {
  if (score < 5) return 'bg-[#d05158]';
  if (score < 8) return 'bg-[#a98217]';
  return 'bg-[#2a8c5a]';
}

const scoreFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function ReviewScore({ score }: Readonly<{ score: number }>) {
  const formatted = scoreFormatter.format(score);
  return (
    <div
      aria-label={`Nota ${formatted} de 10`}
      className={`inline-grid size-14 shrink-0 place-items-center rounded-full tabular-nums text-white ${scoreColor(score)}`}
    >
      <span className="text-3xl leading-none font-semibold">{formatted}</span>
    </div>
  );
}

function ReviewSearchLoading() {
  return (
    <LoadingPreview label="Pesquisando jogos">
      <div className="grid auto-rows-[104px] gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: searchPageSize }, (_, index) => (
          <div
            className="flex items-center gap-3 rounded-xl border border-border p-3"
            key={index}
          >
            <Skeleton className="h-16 w-12 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </LoadingPreview>
  );
}

function ReviewDate({ value }: Readonly<{ value: string | null | undefined }>) {
  const date = value ? new Date(value) : null;
  if (date === null || Number.isNaN(date.getTime())) {
    return <span>Data indisponível</span>;
  }

  return <time dateTime={date.toISOString()}>{date.toLocaleDateString('pt-BR')}</time>;
}

function ReviewDetailsModal({
  review,
  author,
  onClose,
}: Readonly<{
  review: Review;
  author: string;
  onClose: () => void;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="review-details-title"
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-content-primary shadow-2xl backdrop:bg-text-primary/75"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="relative p-5 sm:p-7">
        <button
          type="button"
          aria-label="Fechar avaliação"
          onClick={onClose}
     className="absolute top-3 right-3 grid size-11 place-items-center rounded-lg text-text-muted hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand"
        >
          <X aria-hidden="true" size={18} strokeWidth={1.5} />
        </button>
        <div className="flex items-start gap-4 pr-12">
          {review.cover_url && (
            <img
              src={review.cover_url}
              alt=""
              className="aspect-[2/3] w-16 shrink-0 rounded-lg object-cover sm:w-20"
            />
          )}
          <div className="min-w-0">
            <div className="mb-3">
              <ReviewScore score={review.score} />
            </div>
            <h2
              id="review-details-title"
              className="break-words font-heading text-lg font-semibold"
            >
              {review.name}
            </h2>
          </div>
        </div>
        {review.analysis?.trim() ? (
          <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-content-primary">
            {review.analysis}
          </p>
        ) : null}
        <footer className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs text-text-muted">
          <span className="break-words font-semibold text-content-primary">{author}</span>
          <span aria-hidden="true">·</span>
          <ReviewDate value={review.updated_at} />
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}

function ReviewEditorModal({
  children,
  onBack,
  onClose,
  title,
}: Readonly<{
  children: ReactNode;
  onBack?: () => void;
  onClose: () => void;
  title: string;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="review-editor-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface p-0 text-content-primary shadow-2xl backdrop:bg-text-primary/75 sm:w-[calc(100%-2rem)]"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            {onBack ? (
              <button
                aria-label="Voltar para a busca"
                className="grid size-10 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={onBack}
                type="button"
              >
                <ArrowLeft aria-hidden="true" size={20} />
              </button>
            ) : null}
            <h2 id="review-editor-title" className="truncate font-heading text-xl font-semibold">
              {title}
            </h2>
          </div>
          <button
            aria-label="Fechar avaliação"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}

export function ReviewsPage() {
  const { state } = useAuth();
  const userId = state.status === 'authenticated' ? state.user.id : null;
  const client = getSupabaseClient();
  const [query, setQuery] = useState('');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [results, setResults] = useState<readonly GameSearchResult[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const searchPageCount = Math.ceil(results.length / searchPageSize);
  const visibleResults = results.slice(
    (searchPage - 1) * searchPageSize,
    searchPage * searchPageSize,
  );
  const [selected, setSelected] = useState<{
    id: number;
    name: string;
    coverUrl: string | null;
  } | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewStep, setReviewStep] = useState<'search' | 'form'>('search');
  const [score, setScore] = useState('');
  const [scorePreview, setScorePreview] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState('');
  const selectedScore = score === '' ? null : Number(score);
  const displayedScore = scorePreview ?? selectedScore;
  const scoreLabel = displayedScore === null ? '—' : String(displayedScore);
  const scoreDescription =
    displayedScore === null
      ? 'Passe o mouse ou escolha uma nota'
      : displayedScore <= 4
        ? 'Flopou'
        : displayedScore <= 7
          ? 'Mista ou mediana'
          : displayedScore <= 9
            ? 'Excelente'
            : 'GOTY';
  const [isPublic, setIsPublic] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsOwnerId, setReviewsOwnerId] = useState<string | null>(null);
  const [viewedReview, setViewedReview] = useState<Review | null>(null);
  const [viewedReviewOwnerId, setViewedReviewOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const collectionError =
    loadError || (client === null ? 'Não foi possível carregar suas avaliações' : '');
  const reviewsBelongToCurrentUser = userId !== null && reviewsOwnerId === userId;
  const visibleReviews = reviewsBelongToCurrentUser ? reviews : [];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function openReviewModal() {
    setQuery('');
    setSearchResultsOpen(false);
    setResults([]);
    setSearchPage(1);
    setSearching(false);
    setSelected(null);
    setReviewStep('search');
    setScore('');
    setScorePreview(null);
    setAnalysis('');
    setIsPublic(true);
    setSearchError('');
    setError('');
    setMessage('');
    setIsReviewModalOpen(true);
  }

  function closeReviewModal() {
    setIsReviewModalOpen(false);
    setSelected(null);
    setReviewStep('search');
    setQuery('');
    setSearchResultsOpen(false);
    setResults([]);
    setSearching(false);
    setSearchError('');
    setError('');
  }

  function returnToSearch() {
    setSelected(null);
    setReviewStep('search');
    setSearchResultsOpen(query.trim().length >= 2);
    setError('');
  }
  useEffect(() => {
    let active = true;
    if (!client || !userId) return;
    void client
      .from('game_reviews')
      .select('igdb_id,name,cover_url,score,analysis,is_public,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .then(
        ({ data, error }) => {
          if (!active) return;
          setLoading(false);
          if (error) setLoadError('Não foi possível carregar suas avaliações');
          else {
            setLoadError('');
            setReviews(data);
            setReviewsOwnerId(userId);
          }
        },
        () => {
          if (!active) return;
          setLoading(false);
          setLoadError('Não foi possível carregar suas avaliações');
        },
      );
    return () => {
      active = false;
    };
  }, [client, userId, loadAttempt]);
  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchGames(query, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data);
            setSearchPage(1);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setSearchError('Não foi possível pesquisar jogos. Tente novamente.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  function choose(game: { id: number; name: string; coverUrl: string | null }) {
    const existing = reviewsBelongToCurrentUser
      ? reviews.find((r) => r.igdb_id === game.id)
      : undefined;
    setSelected(game);
    setReviewStep('form');
    setIsReviewModalOpen(true);
    setSearchResultsOpen(false);
    setScore(existing && existing.score >= 1 ? String(Math.round(existing.score)) : '');
    setScorePreview(null);
    setAnalysis(existing?.analysis ?? '');
    setIsPublic(existing?.is_public ?? true);
    setMessage('');
    setError('');
  }
  async function save(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!client || !userId || !selected || saving) return;
    if (
      score === '' ||
      !Number.isFinite(Number(score)) ||
      Number(score) < 1 ||
      Number(score) > 10
    ) {
      setError('Informe uma nota de 1 a 10.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const record = {
      igdb_id: selected.id,
      name: selected.name,
      cover_url: selected.coverUrl,
      score: Number(score),
      analysis: analysis.trim(),
      is_public: isPublic,
      updated_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await client
        .from('game_reviews')
        .upsert({ ...record, user_id: userId }, { onConflict: 'user_id,igdb_id' })
        .select('igdb_id,name,cover_url,score,analysis,is_public,updated_at')
        .single();
      if (error) throw error;
      setReviews((current) => [data, ...current.filter((r) => r.igdb_id !== record.igdb_id)]);
      setReviewsOwnerId(userId);
      setLoading(false);
      setLoadError('');
      setSelected(null);
      setIsReviewModalOpen(false);
      setReviewStep('search');
      setQuery('');
      setSearchResultsOpen(false);
      setResults([]);
      setMessage('Avaliação salva');
    } catch {
      setError('Não foi possível salvar a avaliação. Seu texto foi mantido para tentar novamente.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="site-container min-h-[calc(100dvh-3.5rem)] pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1
          id="my-reviews"
          className="flex items-center gap-2 font-heading text-2xl font-semibold text-content-primary"
        >
          <span
            aria-hidden="true"
            className="h-6 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-brand"
          />
          Minhas avaliações
          {!loading && reviewsBelongToCurrentUser && !collectionError && (
            <span className="font-body text-sm font-medium tabular-nums text-text-muted">
              ({visibleReviews.length})
            </span>
          )}
        </h1>
        <button
          aria-haspopup="dialog"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={openReviewModal}
          type="button"
        >
          <Plus aria-hidden="true" size={18} />
          Adicionar avaliação
        </button>
      </div>
      {message && (
        <p role="status" className="mt-4 text-sm text-content-primary">
          {message}
        </p>
      )}
      {isReviewModalOpen && (
        <ReviewEditorModal
          title={
            selected
              ? visibleReviews.some((review) => review.igdb_id === selected.id)
                ? 'Editar avaliação'
                : 'Preencher avaliação'
              : 'Adicionar avaliação'
          }
          onBack={selected && reviewStep === 'form' ? returnToSearch : undefined}
          onClose={closeReviewModal}
        >
      {reviewStep === 'search' && (
      <section aria-label="Pesquisar jogos para avaliar">
        <label htmlFor="review-search" className="mb-2 block font-semibold">
          Pesquisar jogo para avaliação
        </label>
        <input
          id="review-search"
          autoFocus
          type="search"
          className={field}
          placeholder="Buscar pelo nome"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchError('');
            setResults([]);
            setSearchPage(1);
            setSearching(e.target.value.trim().length >= 2);
            setSearchResultsOpen(true);
          }}
        />
        {searchResultsOpen && query.trim().length >= 2 && (
          <div className="mt-3">
            {searching ? (
              <ReviewSearchLoading />
            ) : searchError ? (
              <p role="alert" className="text-sm text-red-700">
                {searchError}
              </p>
            ) : results.length ? (
              <>
                <div
                  className={`grid auto-rows-[104px] content-start gap-2 sm:grid-cols-2 lg:grid-cols-4 ${
                    searchPageCount > 1 ? 'min-h-[888px] sm:min-h-[440px] lg:min-h-[216px]' : ''
                  }`}
                >
                  {visibleResults.map((game) => (
                    <button
                      type="button"
                      key={game.id}
                      title={game.name}
                      aria-pressed={selected?.id === game.id}
                      onClick={() => {
                        choose(game);
                      }}
                      className="flex h-[104px] min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border p-3 text-left transition-colors duration-150 hover:border-border aria-pressed:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {game.coverUrl ? (
                        <img
                          src={game.coverUrl}
                          alt=""
                          className="h-16 w-12 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div aria-hidden="true" className="h-16 w-12 shrink-0 rounded bg-brand-bright/10" />
                      )}
                      <span className="line-clamp-2 min-w-0 break-words text-sm leading-5">
                        {game.name}
                      </span>
                    </button>
                  ))}
                </div>
                {searchPageCount > 1 && (
                  <nav
                    aria-label="Páginas dos resultados de jogos"
                    className="mt-4 flex flex-wrap items-center justify-center gap-2"
                  >
                    <button
                      type="button"
                      disabled={searchPage === 1}
           className="min-h-11 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-40"
                      onClick={() => {
                        setSearchPage((page) => page - 1);
                      }}
                    >
                      Anterior
                    </button>
                    {Array.from({ length: searchPageCount }, (_, index) => index + 1).map(
                      (page) => (
                        <button
                          key={page}
                          type="button"
                          aria-label={`Página ${String(page)}`}
                          aria-current={searchPage === page ? 'page' : undefined}
             className="grid size-11 place-items-center rounded-lg border border-border text-sm transition-colors hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand aria-current:bg-brand aria-current:text-white aria-current:hover:bg-brand-hover aria-current:hover:text-white"
                          onClick={() => {
                            setSearchPage(page);
                          }}
                        >
                          {page}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      disabled={searchPage === searchPageCount}
           className="min-h-11 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-40"
                      onClick={() => {
                        setSearchPage((page) => page + 1);
                      }}
                    >
                      Próxima
                    </button>
                    <p role="status" className="w-full text-center text-xs text-text-muted">
                      Página {searchPage} de {searchPageCount} · {results.length} jogos encontrados
                    </p>
                  </nav>
                )}
              </>
            ) : (
              <p className="text-text-muted">Nenhum jogo encontrado.</p>
            )}
          </div>
        )}
      </section>
      )}
      {selected && reviewStep === 'form' && (
        <section aria-labelledby="review-form-heading">
          {error ? (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <form onSubmit={(e) => void save(e)} className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {selected.coverUrl && (
                  <img src={selected.coverUrl} alt="" className="h-20 w-14 rounded object-cover" />
                )}
                <h2
                  id="review-form-heading"
                  className="min-w-0 break-words font-heading text-xl font-semibold"
                >
                  {selected.name}
                </h2>
              </div>
              <fieldset className="shrink-0">
                <legend className="sr-only">Visibilidade da avaliação</legend>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-border has-checked:border-brand/60">
                    <input
                      className="accent-brand"
                      type="radio"
                      name="review-visibility"
                      value="public"
                      checked={isPublic}
                      onChange={() => setIsPublic(true)}
                    />
                    Pública
                    <span className="sr-only">
                      Outras pessoas poderão encontrar e ler esta avaliação.
                    </span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-border has-checked:border-brand/60">
                    <input
                      className="accent-brand"
                      type="radio"
                      name="review-visibility"
                      value="private"
                      checked={!isPublic}
                      onChange={() => setIsPublic(false)}
                    />
                    Privada
                    <span className="sr-only">Só você poderá ver esta avaliação.</span>
                  </label>
                </div>
              </fieldset>
            </div>
              <fieldset
                className="max-w-xl space-y-3"
                onMouseLeave={() => setScorePreview(null)}
              >
                <legend className="sr-only">Sua nota, de 1 a 10</legend>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
                      Sua nota
                    </p>
                    <p aria-live="polite" className="mt-1 text-sm font-semibold">
                      {scoreDescription}
                    </p>
                  </div>
                  <output
                    className={`grid size-16 shrink-0 place-items-center rounded-full border-2 font-heading text-3xl font-bold ${
                      displayedScore === null
                        ? 'border-border text-content-primary'
                        : displayedScore <= 4
                          ? 'border-rose-400 bg-rose-400 text-black'
                          : displayedScore <= 7
                            ? 'border-amber-400 bg-amber-400 text-black'
                            : 'border-emerald-500 bg-emerald-500 text-black'
                    }`}
                  >
                    {scoreLabel}
                  </output>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }, (_, index) => {
                    const value = index + 1;
                    const colorClass =
                      displayedScore === null
                        ? ''
                        : displayedScore <= 4
                          ? 'bg-rose-400'
                          : displayedScore <= 7
                            ? 'bg-amber-400'
                            : 'bg-emerald-500';
                    const idleColorClass =
                      value <= 4
                        ? 'bg-rose-400/40'
                        : value <= 7
                          ? 'bg-amber-400/40'
                          : 'bg-emerald-500/40';
                    const isFilled = displayedScore !== null && value <= displayedScore;
                    return (
                      <label
                        key={value}
                        className="min-w-0 flex-1 cursor-pointer"
                        onMouseEnter={() => setScorePreview(value)}
                      >
                        <input
                          className="peer sr-only"
                          type="radio"
                          name="review-score"
                          value={value}
                          checked={score === String(value)}
                          required={value === 1}
                          aria-label={`Nota ${value}`}
                          onFocus={() => setScorePreview(value)}
                          onBlur={() => setScorePreview(null)}
                          onChange={() => setScore(String(value))}
                        />
                        <span
                          aria-hidden="true"
                          className={`block h-3 rounded-sm transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ${
                            isFilled ? colorClass : displayedScore === null ? idleColorClass : 'bg-brand-bright/20'
                          }`}
                        />
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-text-muted" aria-hidden="true">
                  <span>1</span>
                  <span>10</span>
                </div>
              </fieldset>
            <label className="block text-sm font-medium">
              Sua análise <span className="font-normal text-text-muted">(opcional)</span>
              <textarea
                className={`${field} mt-2 min-h-40`}
                maxLength={10000}
                value={analysis}
                onChange={(e) => {
                  setAnalysis(e.target.value);
                }}
                placeholder="O que você achou deste jogo?"
              />
            </label>
            <div className="flex gap-3">
              <button
                disabled={saving}
        className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {saving ? 'Salvando…' : 'Salvar avaliação'}
              </button>
              <button
                type="button"
        className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-brand-bright/30 hover:text-brand-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                disabled={saving}
                onClick={closeReviewModal}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
        </ReviewEditorModal>
      )}
      <section className="mt-8" aria-labelledby="my-reviews">
        {collectionError ? (
          <div role="alert" className="mt-4 rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-text-muted">{collectionError}</p>
            {client !== null && (
              <button
                type="button"
        className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand"
                onClick={() => {
                  setLoadError('');
                  setLoading(true);
                  setLoadAttempt((value) => value + 1);
                }}
              >
                Tentar novamente
              </button>
            )}
          </div>
        ) : loading || !reviewsBelongToCurrentUser ? (
          <ReviewsLoading />
        ) : visibleReviews.length === 0 ? (
          <p className="mt-4 text-text-muted">
          Você ainda não avaliou nenhum jogo. Adicione uma avaliação para começar.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visibleReviews.map((review) => (
              <article
                key={review.igdb_id}
                className="relative flex h-[280px] min-w-0 flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border"
              >
                <button
                  type="button"
                  aria-label={`Ver avaliação completa de ${review.name}`}
                  aria-haspopup="dialog"
                  className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={() => {
                    setViewedReview(review);
                    setViewedReviewOwnerId(userId);
                  }}
                />
                <div className="pointer-events-none flex min-h-0 flex-1 items-start gap-3 sm:gap-4">
                  {review.cover_url ? (
                    <img
                      src={review.cover_url}
                      alt=""
                      className="aspect-[2/3] w-16 shrink-0 rounded-lg object-cover sm:w-20"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="aspect-[2/3] w-16 shrink-0 rounded-lg bg-brand-bright/10 sm:w-20"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex h-24 flex-col items-start gap-2 pr-12 sm:h-16 sm:flex-row sm:items-center sm:gap-3">
                      <ReviewScore score={review.score} />
                      <h3
                        className="line-clamp-2 min-w-0 break-words font-heading text-sm leading-5 font-semibold"
                        title={review.name}
                      >
                        {review.name}
                      </h3>
                    </div>
                    {review.analysis?.trim() ? (
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-muted sm:line-clamp-4">
                        {review.analysis}
                      </p>
                    ) : null}
                  </div>
                </div>
                <footer className="pointer-events-none mt-4 flex h-9 shrink-0 items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">
                  <span className="min-w-0 truncate font-semibold text-content-primary">
                    {state.status === 'authenticated' ? state.user.name : ''}
                  </span>
                  <span>{review.is_public ? 'Pública' : 'Privada'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">
                    <ReviewDate value={review.updated_at} />
                  </span>
                </footer>
                <button
                  type="button"
                  aria-label={`Editar avaliação de ${review.name}`}
                  title="Editar avaliação"
         className="absolute top-3 right-3 z-10 grid size-11 place-items-center rounded-lg text-text-muted transition-colors hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={() => {
                    choose({ id: review.igdb_id, name: review.name, coverUrl: review.cover_url });
                  }}
                >
                  <Pencil aria-hidden="true" size={18} strokeWidth={1.5} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      {viewedReview && viewedReviewOwnerId === userId && (
        <ReviewDetailsModal
          review={viewedReview}
          author={state.status === 'authenticated' ? state.user.name : ''}
          onClose={() => {
            setViewedReview(null);
            setViewedReviewOwnerId(null);
          }}
        />
      )}
    </main>
  );
}
