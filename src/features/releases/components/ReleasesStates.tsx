import { SearchX, TriangleAlert } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';

interface StatePanelProps {
  readonly action?: React.ReactNode;
  readonly body?: string;
  readonly icon: LucideIcon;
  readonly role: 'alert' | 'status';
  readonly title: string;
}

const skeletonIndexes = Array.from({ length: 12 }, (_, index) => index);

function StatePanel({
  action,
  body,
  icon: Icon,
  role,
  title,
}: StatePanelProps): React.ReactElement {
  return (
    <section
      aria-live={role === 'status' ? 'polite' : undefined}
      className="flex flex-col items-center rounded-2xl border border-white/10 bg-surface px-6 py-10 text-center sm:px-10"
      role={role}
    >
      <div className="grid size-12 place-items-center rounded-xl bg-bg-secondary text-text-muted">
        <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
      </div>
      <h2 className="mt-4 font-heading text-lg font-semibold text-content-primary">{title}</h2>
      {body ? <p className="mt-2 max-w-md text-sm text-text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export function ReleasesLoading(): React.ReactElement {
  return (
    <div className="mt-8" role="status" aria-live="polite" aria-label="Carregando jogos">
      <div className="grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-8 xl:grid-cols-4">
        {skeletonIndexes.map((index) => (
          <div
            aria-hidden="true"
            className="animate-pulse motion-reduce:animate-none"
            data-testid="release-card-skeleton"
            key={index}
          >
            <div className="aspect-[16/9] w-full rounded-xl bg-surface" />
            <div className="flex flex-col gap-3 pt-3">
              <div className="h-10 w-3/4 rounded bg-surface" />
              <div className="flex gap-2">
                <div className="h-5 w-10 rounded bg-surface" />
                <div className="h-5 w-14 rounded bg-surface" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReleasesEmpty(): React.ReactElement {
  return (
    <StatePanel
      body="Escolha outra plataforma ou gênero, ou limpe os filtros ativos"
      icon={SearchX}
      role="status"
      title="Nenhum jogo encontrado"
    />
  );
}

export function ReleasesError({ onRetry }: { readonly onRetry: () => void }): React.ReactElement {
  return (
    <StatePanel
      action={
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-content-primary transition-colors hover:bg-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={onRetry}
          type="button"
        >
          Tentar novamente
        </button>
      }
      body="Verifique sua conexão e tente novamente."
      icon={TriangleAlert}
      role="alert"
      title="Não foi possível carregar os jogos"
    />
  );
}
