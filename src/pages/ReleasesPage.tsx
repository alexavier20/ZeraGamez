import { useState } from 'react';

import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';
import { ReleaseList } from '@/features/releases/components/ReleaseList';
import { ReleaseLoadMore } from '@/features/releases/components/ReleaseLoadMore';
import {
  ReleaseCalendarPlaceholder,
  ReleasesEmpty,
  ReleasesError,
  ReleasesLoading,
} from '@/features/releases/components/ReleasesStates';
import {
  ReleaseViewSwitcher,
  type ReleaseView,
} from '@/features/releases/components/ReleaseViewSwitcher';
import { useReleases } from '@/features/releases/hooks/use-releases';
import {
  defaultReleaseFilterSelection,
  toReleaseFilterIds,
  type ReleaseFilterSelection,
  type ReleaseGenreFilterKey,
  type ReleasePlatformFilterKey,
} from '@/features/releases/model/release-filter-options';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

const resultsId = 'release-results';

export function ReleasesPage() {
  const [filters, setFilters] = useState<ReleaseFilterSelection>(defaultReleaseFilterSelection);
  const { loadMore, pagination, retry, retryMore, state } = useReleases(
    toReleaseFilterIds(filters),
  );
  const [view, setView] = useState<ReleaseView>('list');

  const handlePlatformChange = (platform: ReleasePlatformFilterKey) => {
    setFilters((current) => ({ ...current, platform }));
  };

  const handleGenreChange = (genre: ReleaseGenreFilterKey) => {
    setFilters((current) => ({ ...current, genre }));
  };

  const handleClearFilters = () => {
    setFilters(defaultReleaseFilterSelection);
  };

  return (
    <main
      aria-label="Lançamentos"
      className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pt-[22px] pb-28 sm:px-5 sm:pt-7 sm:pb-12 lg:px-8 lg:pt-9"
    >
      <div className="lg:flex lg:items-end lg:justify-between">
        <PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
        <ReleaseViewSwitcher controlsId={resultsId} onChange={setView} value={view} />
      </div>
      <ReleaseFilters
        onClear={handleClearFilters}
        onGenreChange={handleGenreChange}
        onPlatformChange={handlePlatformChange}
        value={filters}
      />
      <section aria-label={'Resultados de lan\u00e7amentos'} id={resultsId}>
        {view === 'calendar' ? (
          <ReleaseCalendarPlaceholder />
        ) : state.status === 'loading' ? (
          <ReleasesLoading />
        ) : state.status === 'error' ? (
          <ReleasesError onRetry={retry} />
        ) : state.status === 'empty' ? (
          <ReleasesEmpty />
        ) : (
          <>
            <ReleaseList response={state.response} />
            <ReleaseLoadMore
              enabled
              onLoadMore={loadMore}
              onRetry={retryMore}
              pagination={pagination}
            />
          </>
        )}
      </section>
    </main>
  );
}
