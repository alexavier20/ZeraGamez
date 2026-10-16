import { AlertTriangle, Gamepad2, LoaderCircle, RotateCw } from 'lucide-react';
import { Link } from 'react-router';

interface GameDetailsErrorProps {
  readonly onRetry: () => void;
}

export function GameDetailsLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
        <LoaderCircle aria-hidden="true" className="animate-spin text-brand" size={32} />
        <p className="text-sm text-text-muted">Carregando detalhes do jogo…</p>
      </div>
    </div>
  );
}

export function GameDetailsError({ onRetry }: GameDetailsErrorProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
        <Gamepad2 aria-hidden="true" className="text-text-muted" size={36} />
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">Jogo não encontrado</h1>
          <p className="mt-2 text-sm text-text-muted">
            Esse jogo não está mais disponível na IGDB.
          </p>
        </div>
        <Link
          className="text-sm font-semibold text-content-primary underline decoration-brand underline-offset-4 hover:text-brand-bright focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          to="/lancamentos"
        >
          Voltar para lançamentos
        </Link>
      </div>
    </div>
  );
}
