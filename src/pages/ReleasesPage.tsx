import { useState } from 'react';

import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';
import {
  ReleaseViewSwitcher,
  type ReleaseView,
} from '@/features/releases/components/ReleaseViewSwitcher';
import { useReleasesConsole } from '@/features/releases/hooks/use-releases-console';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

export function ReleasesPage() {
  useReleasesConsole();
  const [view, setView] = useState<ReleaseView>('list');

  return (
    <main
      aria-label="Lançamentos"
      className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pt-[22px] pb-28 sm:px-5 sm:pt-7 sm:pb-12 lg:px-8 lg:pt-9"
    >
      <div className="lg:flex lg:items-end lg:justify-between">
        <PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
        <ReleaseViewSwitcher onChange={setView} value={view} />
      </div>
      <ReleaseFilters />
    </main>
  );
}
