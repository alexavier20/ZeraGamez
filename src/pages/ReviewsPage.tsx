import { Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { searchGames } from '@/features/games/api/game-search-client';
import { ReviewsLoading } from '@/shared/components/LoadingSkeletons';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';
import { getSupabaseClient } from '@/shared/supabase/client';

import type { GameSearchResult } from '../../shared/contracts/game-search';

interface Review {
  igdb_id: number;
  name: string;
  cover_url: string | null;
  score: number;
  analysis: string;
  updated_at: string;
}
const field = 'w-full rounded-xl border border-white/15 bg-surface p-3 text-content-primary';
const searchPageSize = 8;

function scoreColor(score: number): string {
  if (score < 5) return 'bg-red-500';
  if (score < 8) return 'bg-yellow-400';
  return 'bg-green-500';
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
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-surface p-0 text-content-primary shadow-2xl backdrop:bg-black/75"
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
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-lg text-text-muted hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
        >
          <X aria-hidden="true" size={20} />
        </button>
        <div className="flex items-start gap-4 pr-10">
          {review.cover_url && (
            <img
              src={review.cover_url}
              alt=""
              className="h-28 w-20 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
            <div
              aria-label={`Nota ${String(review.score)} de 10`}
              className={`mb-3 grid size-16 place-items-center rounded-full text-3xl font-bold text-white tabular-nums ${scoreColor(review.score)}`}
            >
              {review.score}
            </div>
            <h2 id="review-details-title" className="break-words text-lg font-bold">
              {review.name}
            </h2>
          </div>
        </div>
        <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-muted">
          {review.analysis}
        </p>
        <footer className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 text-xs text-text-muted">
          <span className="break-words font-semibold text-content-primary">{author}</span>
          <span aria-hidden="true">·</span>
          <ReviewDate value={review.updated_at} />
        </footer>
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
  const [score, setScore] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [viewedReview, setViewedReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    if (!client || !userId) return;
    void client
      .from('game_reviews')
      .select('igdb_id,name,cover_url,score,analysis,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error)
          setError('Não foi possível carregar suas avaliações. Tente recarregar a página.');
        else setReviews(data);
      });
    return () => {
      active = false;
    };
  }, [client, userId]);
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
            setError('Não foi possível pesquisar jogos. Tente novamente.');
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
    const existing = reviews.find((r) => r.igdb_id === game.id);
    setSelected(game);
    setSearchResultsOpen(false);
    setScore(existing ? String(existing.score) : '');
    setAnalysis(existing?.analysis ?? '');
    setMessage('');
    setError('');
  }
  async function save(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!client || !userId || !selected || saving) return;
    if (
      score === '' ||
      !Number.isFinite(Number(score)) ||
      Number(score) < 0 ||
      Number(score) > 10 ||
      !analysis.trim()
    ) {
      setError('Informe uma nota de 0 a 10 e escreva sua análise.');
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
      updated_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await client
        .from('game_reviews')
        .upsert({ ...record, user_id: userId }, { onConflict: 'user_id,igdb_id' })
        .select('igdb_id,name,cover_url,score,analysis,updated_at')
        .single();
      if (error) throw error;
      setReviews((current) => [data, ...current.filter((r) => r.igdb_id !== record.igdb_id)]);
      setSelected(null);
      setMessage('Avaliação salva!');
    } catch {
      setError('Não foi possível salvar a avaliação. Seu texto foi mantido para tentar novamente.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="site-container min-h-screen pb-28 pt-6">
      <PageHeading title="Avaliações" />
      {error && (
        <p role="alert" className="mt-4 text-red-400">
          {error}
        </p>
      )}
      <p role="status" className="mt-3 text-brand">
        {message}
      </p>
      <section
        className="mt-6 rounded-2xl border border-white/10 bg-surface p-5"
        aria-label="Pesquisar jogos para avaliar"
      >
        <label htmlFor="review-search" className="mb-2 block font-bold">
          Pesquisar jogo
        </label>
        <input
          id="review-search"
          className={field}
          placeholder="Digite pelo menos 2 caracteres..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResults([]);
            setSearchPage(1);
            setSearching(e.target.value.trim().length >= 2);
            setSearchResultsOpen(true);
          }}
        />
        {searchResultsOpen && query.trim().length >= 2 && (
          <div className="mt-3">
            {searching ? (
              <p role="status">Pesquisando...</p>
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
                      className="flex h-[104px] min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-white/10 p-3 text-left hover:border-brand aria-pressed:border-brand"
                    >
                      {game.coverUrl && (
                        <img
                          src={game.coverUrl}
                          alt=""
                          className="h-16 w-12 shrink-0 rounded object-cover"
                        />
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
                      className="min-h-10 rounded-lg border border-white/15 px-3 text-sm disabled:cursor-default disabled:opacity-40"
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
                          className="grid size-10 place-items-center rounded-lg border border-white/15 text-sm aria-current:bg-brand aria-current:text-white"
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
                      className="min-h-10 rounded-lg border border-white/15 px-3 text-sm disabled:cursor-default disabled:opacity-40"
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
      {selected && (
        <section
          className="mt-6 rounded-2xl border border-white/10 bg-surface p-5"
          aria-labelledby="review-form-heading"
        >
          <form onSubmit={(e) => void save(e)} className="space-y-4">
            <div className="flex items-center gap-3">
              {selected.coverUrl && (
                <img src={selected.coverUrl} alt="" className="h-20 w-14 rounded object-cover" />
              )}
              <h2 id="review-form-heading" className="text-xl font-bold">
                {selected.name}
              </h2>
            </div>
            <label className="block">
              Nota (0 a 10)
              <input
                className={`${field} mt-2`}
                type="number"
                min="0"
                max="10"
                step="0.1"
                required
                value={score}
                onChange={(e) => {
                  setScore(e.target.value);
                }}
              />
            </label>
            <label className="block">
              Sua análise
              <textarea
                className={`${field} mt-2 min-h-40`}
                required
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
                className="rounded-xl bg-brand px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar avaliação'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSelected(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="mt-8" aria-labelledby="my-reviews">
        <h2 id="my-reviews" className="text-xl font-bold">
          Minhas avaliações ({reviews.length})
        </h2>
        {loading ? (
          <ReviewsLoading />
        ) : reviews.length === 0 ? (
          <p className="mt-4 text-text-muted">
            Você ainda não avaliou nenhum jogo. Pesquise um jogo para começar.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {reviews.map((review) => (
              <article
                key={review.igdb_id}
                className="relative flex h-[280px] min-w-0 flex-col rounded-2xl border border-white/10 bg-surface p-5 transition-colors hover:border-white/25"
              >
                <button
                  type="button"
                  aria-label={`Ver avaliação completa de ${review.name}`}
                  aria-haspopup="dialog"
                  className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={() => {
                    setViewedReview(review);
                  }}
                />
                <div className="pointer-events-none flex min-h-0 flex-1 items-start gap-3 sm:gap-4">
                  {review.cover_url ? (
                    <img
                      src={review.cover_url}
                      alt=""
                      className="h-28 w-14 shrink-0 rounded-lg object-cover sm:w-20"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-28 w-14 shrink-0 rounded-lg bg-white/5 sm:w-20"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex h-24 flex-col items-start gap-2 pr-10 sm:h-16 sm:flex-row sm:items-center sm:gap-3">
                      <div
                        aria-label={`Nota ${String(review.score)} de 10`}
                        className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white sm:size-16 ${scoreColor(review.score)}`}
                      >
                        <strong className="text-3xl leading-none font-bold tabular-nums">
                          {review.score}
                        </strong>
                      </div>
                      <h3
                        className="line-clamp-2 min-w-0 break-words font-bold"
                        title={review.name}
                      >
                        {review.name}
                      </h3>
                    </div>
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-muted sm:line-clamp-4">
                      {review.analysis}
                    </p>
                  </div>
                </div>
                <footer className="pointer-events-none mt-4 flex h-9 shrink-0 items-center gap-2 border-t border-white/10 pt-3 text-xs text-text-muted">
                  <span className="min-w-0 truncate font-semibold text-content-primary">
                    {state.status === 'authenticated' ? state.user.name : ''}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">
                    <ReviewDate value={review.updated_at} />
                  </span>
                </footer>
                <button
                  type="button"
                  aria-label={`Editar avaliação de ${review.name}`}
                  title="Editar avaliação"
                  className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={() => {
                    choose({ id: review.igdb_id, name: review.name, coverUrl: review.cover_url });
                  }}
                >
                  <Pencil aria-hidden="true" size={18} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      {viewedReview && (
        <ReviewDetailsModal
          review={viewedReview}
          author={state.status === 'authenticated' ? state.user.name : ''}
          onClose={() => {
            setViewedReview(null);
          }}
        />
      )}
    </main>
  );
}
