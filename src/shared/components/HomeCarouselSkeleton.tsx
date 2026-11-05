interface HomeCarouselSkeletonProps {
  readonly variant: 'reviews' | 'releases';
}

export function HomeCarouselSkeleton({ variant }: HomeCarouselSkeletonProps) {
  const reviews = variant === 'reviews';
  return (
    <div
      aria-label={reviews ? 'Carregando notas da crítica' : 'Carregando lançamentos do dia'}
      role="status"
      className="flex gap-4 overflow-hidden px-1 pt-1 pb-5"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div
          aria-hidden="true"
          className="w-40 shrink-0 animate-pulse motion-reduce:animate-none sm:w-44"
          key={index}
        >
          <div
            className={
              reviews ? 'aspect-[2/3] rounded-lg bg-surface' : 'aspect-[2/3] rounded-xl bg-surface'
            }
          />
          {reviews ? (
            <>
              <div className="mt-3 flex h-5 items-center">
                <div className="h-3.5 w-4/5 rounded bg-surface" />
              </div>
              <div className="mt-2 flex h-6 items-center gap-2">
                <div className="h-6 w-7 rounded-sm bg-surface" />
                <div className="h-2.5 w-24 rounded bg-surface" />
              </div>
            </>
          ) : (
            <div className="mt-2.5">
              <div className="flex h-10 flex-col gap-2 py-1">
                <div className="h-3 w-4/5 rounded bg-surface" />
                <div className="h-3 w-1/2 rounded bg-surface" />
              </div>
              <div className="mt-2 flex h-6 gap-1.5">
                <div className="h-6 w-10 rounded-md bg-surface" />
                <div className="h-6 w-8 rounded-md bg-surface" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
