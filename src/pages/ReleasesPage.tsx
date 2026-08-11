import { useState } from 'react';

import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';
import { ReleaseList } from '@/features/releases/components/ReleaseList';
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
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

const resultsId = 'release-results';

export function ReleasesPage() {
  const { retry, state } = useReleases();
  const [view, setView] = useState<ReleaseView>('list');

  return (
    <main
      aria-label="Lançamentos"
      className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pt-[22px] pb-28 sm:px-5 sm:pt-7 sm:pb-12 lg:px-8 lg:pt-9"
    >
      <div className="lg:flex lg:items-end lg:justify-between">
        <PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
        <ReleaseViewSwitcher controlsId={resultsId} onChange={setView} value={view} />
      </div>
      <ReleaseFilters />
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
          <ReleaseList response={state.response} />
        )}
      </section>
    </main>
  );
}
