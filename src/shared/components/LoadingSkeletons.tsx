import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-white/10 motion-reduce:animate-none ${className}`}
    />
  );
}

export function LoadingPreview({
  label,
  className = '',
  children,
}: Readonly<{ label: string; className?: string; children: ReactNode }>) {
  return (
    <div role="status" aria-live="polite" aria-label={label} aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function ListCardsLoading({ tiers = false }: Readonly<{ tiers?: boolean }>) {
  return (
    <LoadingPreview label={tiers ? 'Carregando suas Tier Lists' : 'Carregando suas listas'}>
      <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="overflow-hidden rounded-2xl bg-surface" key={index}>
            <div
              className={tiers ? 'grid aspect-[3/1] grid-cols-5' : 'grid aspect-[3/1] grid-cols-3'}
            >
              {Array.from({ length: tiers ? 5 : 3 }, (_, cover) => (
                <Skeleton className="h-full rounded-none border-r border-surface" key={cover} />
              ))}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-3 w-4/5" />
              {tiers && <Skeleton className="h-2.5 w-12" />}
            </div>
          </div>
        ))}
      </div>
    </LoadingPreview>
  );
}

export function GameRowsLoading({
  label = 'Buscando jogos…',
  count = 4,
}: Readonly<{ label?: string; count?: number }>) {
  return (
    <LoadingPreview label={label} className="p-1.5">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex items-center gap-3 rounded-lg px-2 py-2" key={index}>
          <Skeleton className="size-12 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-12 shrink-0" />
        </div>
      ))}
    </LoadingPreview>
  );
}

export function HypeCardsLoading() {
  return (
    <LoadingPreview label="Carregando seus hypes">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[900px]:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="mx-auto flex min-h-[164px] w-full max-w-[320px] flex-col justify-between rounded-xl border border-white/10 bg-surface p-3"
            key={index}
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-1">
              {[0, 1, 2].map((unit) => (
                <Skeleton className="h-11 rounded-md" key={unit} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadingPreview>
  );
}

export function ReviewsLoading() {
  return (
    <LoadingPreview label="Carregando avaliações..." className="mt-4">
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div
            className="flex h-[280px] flex-col rounded-2xl border border-white/10 bg-surface p-5"
            key={index}
          >
            <div className="flex flex-1 items-start gap-3 sm:gap-4">
              <Skeleton className="h-28 w-14 shrink-0 rounded-lg sm:w-20" />
              <div className="min-w-0 flex-1">
                <div className="flex h-24 flex-col gap-2 sm:h-16 sm:flex-row sm:items-center sm:gap-3">
                  <Skeleton className="size-12 shrink-0 rounded-full sm:size-16" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="mt-3 space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex h-9 items-center gap-2 border-t border-white/10 pt-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </LoadingPreview>
  );
}

export function TierBoardLoading() {
  return (
    <LoadingPreview label="Carregando Tier List…">
      <div className="flex items-end justify-between gap-4">
        <div className="w-2/3 space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-10 w-20 rounded-xl" />
      </div>
      <Skeleton className="mt-7 h-12 w-full rounded-xl" />
      <Skeleton className="mt-7 h-6 w-40" />
      <div className="mt-3 flex min-h-24 gap-1 rounded-xl border border-dashed border-white/20 bg-surface/40 p-3">
        {[0, 1, 2].map((index) => (
          <Skeleton className="h-20 w-14" key={index} />
        ))}
      </div>
      <div className="mt-7 space-y-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            className="flex min-h-24 overflow-hidden rounded-xl border border-white/10 bg-surface/40"
            key={index}
          >
            <Skeleton className="w-16 shrink-0 rounded-none sm:w-20" />
            <div className="flex flex-1 gap-1 p-2">
              {[0, 1].map((tile) => (
                <Skeleton className="h-20 w-14" key={tile} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadingPreview>
  );
}

export function ProfileLoading() {
  return (
    <main className="site-container min-h-[calc(100dvh-3.5rem)] max-w-xl pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7">
      <LoadingPreview label="Carregando perfil">
        <Skeleton className="mb-4 h-9 w-20" />
        <div className="rounded-2xl border border-white/10 bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-9 w-16" />
          </div>
          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <Skeleton className="h-6 w-52" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-40 rounded-xl" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="ml-auto h-11 w-36 rounded-xl" />
          </div>
        </div>
      </LoadingPreview>
    </main>
  );
}

export function ListSelectionLoading() {
  return (
    <LoadingPreview label="Carregando suas listas…">
      <Skeleton className="mb-3 h-3 w-32" />
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((index) => (
          <div
            className="space-y-2 rounded-xl border border-border-brand bg-bg-secondary p-2.5"
            key={index}
          >
            <Skeleton className="h-[72px] w-full rounded-lg" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </LoadingPreview>
  );
}

export function ListGamesLoading({ grid }: Readonly<{ grid: boolean }>) {
  return (
    <LoadingPreview label="Carregando jogos…">
      {grid ? (
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border-brand p-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="overflow-hidden rounded-lg bg-surface" key={index}>
              <Skeleton className="aspect-video rounded-none" />
              <div className="px-3 py-2.5">
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-brand">
          <div className="flex gap-6 border-b border-border-brand bg-bg-secondary px-4 py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-28" />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="flex items-center gap-3 border-b border-border-brand px-4 py-3"
              key={index}
            >
              <Skeleton className="h-12 w-9 shrink-0 rounded-md" />
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="ml-auto hidden h-3 w-24 sm:block" />
              <Skeleton className="size-8 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </LoadingPreview>
  );
}

export function ProtectedPageLoading({ pathname }: Readonly<{ pathname: string }>) {
  let content: ReactNode;
  if (pathname === '/perfil') {
    content = <ProfileLoading />;
  } else {
    const creating = pathname === '/minhas-listas/nova';
    const reviews = pathname === '/avaliacoes';
    content = (
      <main
        className={
          creating
            ? 'site-container max-w-2xl pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7'
            : 'site-container pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7'
        }
      >
        {pathname.startsWith('/minhas-listas/tier/') ? (
          <>
            <Skeleton className="mb-5 h-5 w-28" />
            <TierBoardLoading />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="w-2/3 space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              {!creating && <Skeleton className="h-11 w-28 rounded-xl" />}
            </div>
            {creating ? (
              <div className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-surface p-5 sm:p-7">
                {[0, 1].map((index) => (
                  <div className="space-y-2" key={index}>
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ))}
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                </div>
                <Skeleton className="ml-auto h-11 w-28 rounded-xl" />
              </div>
            ) : reviews ? (
              <>
                <Skeleton className="mt-6 h-12 w-full rounded-xl" />
                <Skeleton className="mt-8 h-7 w-48" />
                <ReviewsLoading />
              </>
            ) : (
              <div className="mt-8">
                <ListCardsLoading />
                <Skeleton className="mt-10 mb-4 h-8 w-48" />
                <ListCardsLoading tiers />
              </div>
            )}
          </>
        )}
      </main>
    );
  }
  return <LoadingPreview label="Verificando sua sessão">{content}</LoadingPreview>;
}
