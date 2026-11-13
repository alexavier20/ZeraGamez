import { useEffect, useRef } from 'react';

import { LoadingPreview, Skeleton } from '@/shared/components/LoadingSkeletons';

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

    let active = true;
    let triggered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!active || triggered || !entries.some((entry) => entry.isIntersecting)) return;

        triggered = true;
        observer.disconnect();
        onLoadMore();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinelRef.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [enabled, onLoadMore, pagination.status]);

  if (!enabled) return null;

  if (pagination.status === 'loading') {
    return (
      <LoadingPreview label="Carregando mais lançamentos…" className="mt-8">
        <div className="grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-8 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index}>
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="mt-3 h-10 w-3/4" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-5 w-14" />
              </div>
            </div>
          ))}
        </div>
      </LoadingPreview>
    );
  }

  if (pagination.status === 'error') {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 text-center" role="alert">
        <p className="text-sm text-text-muted">Não foi possível carregar mais jogos</p>
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-hover hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
      <p aria-live="polite" className="mt-8 text-center text-sm text-text-muted" role="status">
        Todos os lançamentos disponíveis foram carregados
      </p>
    );
  }

  if (typeof IntersectionObserver === 'undefined') {
    return (
      <div className="mt-8 flex justify-center">
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-hover hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={onLoadMore}
          type="button"
        >
          Carregar mais lançamentos
        </button>
      </div>
    );
  }

  return <div aria-hidden="true" className="mt-8 min-h-4" ref={sentinelRef} />;
}
