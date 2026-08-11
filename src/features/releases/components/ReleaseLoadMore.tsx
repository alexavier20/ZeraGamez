import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { ReleasesPagination } from '@/features/releases/hooks/use-releases';
import type * as React from 'react';

export interface ReleaseLoadMoreProps {
  readonly enabled: boolean;
  readonly pagination: ReleasesPagination;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
}

export function ReleaseLoadMore({
  enabled,
  onLoadMore,
  onRetry,
  pagination,
}: ReleaseLoadMoreProps): React.ReactElement | null {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || pagination.status !== 'idle' || !sentinelRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinelRef.current);
    return () => {
      observer.disconnect();
    };
  }, [enabled, onLoadMore, pagination.status]);

  if (!enabled) return null;

  if (pagination.status === 'loading') {
    return (
      <div
        aria-live="polite"
        className="mt-7 flex items-center justify-center gap-2 text-sm text-text-muted"
        role="status"
      >
        <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
        Carregando mais lançamentos…
      </div>
    );
  }

  if (pagination.status === 'error') {
    return (
      <div className="mt-7 flex flex-col items-center gap-3 text-center" role="alert">
        <p className="text-sm text-text-muted">Não foi possível carregar mais jogos</p>
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={onRetry}
          type="button"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (pagination.status === 'complete') {
    return (
      <p aria-live="polite" className="mt-7 text-center text-sm text-text-muted" role="status">
        Todos os lançamentos disponíveis foram carregados
      </p>
    );
  }

  if (typeof IntersectionObserver === 'undefined') {
    return (
      <div className="mt-7 flex justify-center">
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={onLoadMore}
          type="button"
        >
          Carregar mais lançamentos
        </button>
      </div>
    );
  }

  return <div aria-hidden="true" className="mt-7 min-h-4" ref={sentinelRef} />;
}
