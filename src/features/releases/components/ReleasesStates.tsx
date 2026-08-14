import { LoaderCircle, SearchX, TriangleAlert } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';

interface StatePanelProps {
  readonly action?: React.ReactNode;
  readonly body?: string;
  readonly icon: LucideIcon;
  readonly role: 'alert' | 'status';
  readonly title: string;
}

const skeletonIndexes = [0, 1, 2, 3] as const;

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
      className="flex flex-col items-center rounded-2xl border border-border-brand bg-surface px-6 py-10 text-center sm:px-10"
      role={role}
    >
      <div className="grid size-12 place-items-center rounded-xl bg-bg-secondary text-brand-bright">
        <Icon aria-hidden="true" size={24} />
      </div>
      <h2 className="mt-4 font-heading text-lg font-semibold text-content-primary">{title}</h2>
      {body ? <p className="mt-2 max-w-md text-sm text-text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export function ReleasesLoading(): React.ReactElement {
  return (
    <div className="mt-7 space-y-4">
      <StatePanel icon={LoaderCircle} role="status" title="Carregando jogos" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {skeletonIndexes.map((index) => (
          <div
            aria-hidden="true"
            className="h-56 animate-pulse rounded-2xl border border-border-brand bg-surface"
            data-testid="release-card-skeleton"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

export function ReleasesEmpty(): React.ReactElement {
  return (
    <StatePanel
      body="Tente outro termo ou limpe os filtros ativos."
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
