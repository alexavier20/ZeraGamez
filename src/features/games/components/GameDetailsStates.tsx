import { AlertTriangle, ArrowLeft, Gamepad2, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router';

import { LoadingPreview, Skeleton } from '@/shared/components/LoadingSkeletons';

interface GameDetailsErrorProps {
  readonly onRetry: () => void;
}

export function GameDetailsLoading() {
  return (
    <main className="site-container pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7">
      <LoadingPreview label="Carregando detalhes do jogo…">
        <Skeleton className="mb-5 h-5 w-20" />
        <div className="grid gap-6 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:p-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8 lg:p-8">
          <Skeleton className="mx-auto aspect-[3/4] w-40 rounded-2xl sm:mx-0 sm:w-full" />
          <div className="flex min-w-0 flex-col justify-center">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2 h-9 w-3/4" />
            <div className="mt-5 flex gap-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="mt-5 flex gap-2">
              {[0, 1, 2].map((index) => (
                <Skeleton className="h-7 w-20 rounded-full" key={index} />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {[0, 1, 2].map((index) => (
                <Skeleton className="h-11 w-32 rounded-xl" key={index} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)] lg:gap-14">
          <div>
            <Skeleton className="h-7 w-40" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton className="h-4 w-full" key={index} />
              ))}
            </div>
            <Skeleton className="mt-10 h-7 w-32" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <Skeleton className="aspect-video rounded-xl" key={index} />
              ))}
            </div>
          </div>
          <div className="space-y-5 border-t-2 border-brand pt-4">
            <Skeleton className="h-7 w-32" />
            {[0, 1, 2, 3].map((index) => (
              <div className="space-y-3 border-t border-border py-4" key={index}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </LoadingPreview>
    </main>
  );
}

export function GameDetailsError({ onRetry }: GameDetailsErrorProps) {
  return (
    <div className="site-container py-8 sm:py-10">
      <div
        className="flex min-h-64 flex-col items-center justify-center gap-4 text-center"
        role="alert"
      >
        <AlertTriangle aria-hidden="true" className="text-brand" size={32} />
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">
            Não foi possível carregar este jogo
          </h1>
          <p className="mt-2 max-w-md text-sm text-text-muted">
            A conexão falhou. Tente novamente em alguns instantes.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-brand bg-surface px-4 text-sm font-semibold text-content-primary transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={onRetry}
          type="button"
        >
          <RotateCw aria-hidden="true" size={16} />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export function GameDetailsNotFound() {
  const navigate = useNavigate();

  return (
    <div className="site-container py-8 sm:py-10">
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
        <Gamepad2 aria-hidden="true" className="text-text-muted" size={36} />
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">Jogo não encontrado</h1>
          <p className="mt-2 text-sm text-text-muted">
            Esse jogo não está mais disponível na IGDB.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 text-sm font-semibold text-content-primary underline decoration-brand underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          onClick={() => {
            const historyIndex = window.history.state?.idx;
            if (typeof historyIndex === 'number' && historyIndex > 0) {
              void navigate(-1);
            } else {
              void navigate('/lancamentos');
            }
          }}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Voltar
        </button>
      </div>
    </div>
  );
}
