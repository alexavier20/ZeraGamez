import { useEffect, useState } from 'react';

import { ReleaseCalendarControl } from '@/features/releases/components/ReleaseCalendarControl';
import { ReleaseDateEmpty } from '@/features/releases/components/ReleaseDateEmpty';
import { ReleaseFilters } from '@/features/releases/components/ReleaseFilters';
import { ReleaseList } from '@/features/releases/components/ReleaseList';
import { ReleaseLoadMore } from '@/features/releases/components/ReleaseLoadMore';
import {
  ReleasesEmpty,
  ReleasesError,
  ReleasesLoading,
} from '@/features/releases/components/ReleasesStates';
import { useReleases, type ReleasesState } from '@/features/releases/hooks/use-releases';
import { calendarMonthStart, todayInSaoPaulo } from '@/features/releases/model/release-calendar';
import {
  defaultReleaseFilterSelection,
  toReleaseFilterIds,
  type ReleaseFilterSelection,
  type ReleaseGenreFilterKey,
  type ReleasePlatformFilterKey,
} from '@/features/releases/model/release-filter-options';
import { formatReleaseDate } from '@/features/releases/model/release-presentation';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

const resultsId = 'release-results';

function releaseSubtitle(selectedDate: string | null, state: ReleasesState): string {
  if (selectedDate === null) return 'Descubra os games que estão chegando';
  const date = formatReleaseDate(selectedDate, false);
  if (state.status === 'success') {
    const count = state.response.data.length;
    return `${String(count)} ${count === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'} em ${date}`;
  }
  if (state.status === 'empty') return `Nenhum lançamento encontrado em ${date}`;
  return 'Descubra os games que estão chegando';
}

export function ReleasesPage() {
  const currentDate = todayInSaoPaulo();
  const [filters, setFilters] = useState<ReleaseFilterSelection>(defaultReleaseFilterSelection);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => calendarMonthStart(currentDate));
  const [knownReleaseDates, setKnownReleaseDates] = useState<ReadonlySet<string>>(() => new Set());
  const { loadMore, pagination, retry, retryMore, state } = useReleases({
    ...toReleaseFilterIds(filters),
    ...(selectedDate === null ? {} : { date: selectedDate }),
  });

  useEffect(() => {
    if (selectedDate === null && state.status === 'success') {
      const releaseDates = new Set(state.response.data.map((item) => item.releaseDate));
      let active = true;
      queueMicrotask(() => {
        if (active) setKnownReleaseDates(releaseDates);
      });
      return () => {
        active = false;
      };
    }
  }, [selectedDate, state]);

  const handlePlatformChange = (platform: ReleasePlatformFilterKey) => {
    setFilters((current) => ({ ...current, platform }));
  };

  const handleGenreChange = (genre: ReleaseGenreFilterKey) => {
    setFilters((current) => ({ ...current, genre }));
  };

  const handleClearFilters = () => {
    setFilters(defaultReleaseFilterSelection);
    setSelectedDate(null);
    setVisibleMonth(calendarMonthStart(currentDate));
    setCalendarOpen(false);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setVisibleMonth(calendarMonthStart(date));
    setCalendarOpen(false);
  };

  const handleClearDate = () => {
    setSelectedDate(null);
    setVisibleMonth(calendarMonthStart(currentDate));
    setCalendarOpen(false);
  };

  const handleCalendarOpenChange = (open: boolean) => {
    if (open) setVisibleMonth(calendarMonthStart(selectedDate ?? currentDate));
    setCalendarOpen(open);
  };

  return (
    <main
      aria-label="Lançamentos"
      className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pt-[22px] pb-28 sm:px-5 sm:pt-7 sm:pb-12 lg:px-8 lg:pt-9"
    >
      <div className="lg:flex lg:items-end lg:justify-between">
        <PageHeading title="Próximos lançamentos" subtitle={releaseSubtitle(selectedDate, state)} />
        <ReleaseCalendarControl
          controlsId={resultsId}
          currentDate={currentDate}
          knownReleaseDates={knownReleaseDates}
          month={visibleMonth}
          onClearDate={handleClearDate}
          onMonthChange={setVisibleMonth}
          onOpenChange={handleCalendarOpenChange}
          onSelectDate={handleSelectDate}
          open={calendarOpen}
          selectedDate={selectedDate}
        />
      </div>
      <ReleaseFilters
        additionalFilterActive={selectedDate !== null}
        onClear={handleClearFilters}
        onGenreChange={handleGenreChange}
        onPlatformChange={handlePlatformChange}
        value={filters}
      />
      <section aria-label={'Resultados de lan\u00e7amentos'} id={resultsId}>
        {state.status === 'loading' ? (
          <ReleasesLoading />
        ) : state.status === 'error' ? (
          <ReleasesError onRetry={retry} />
        ) : state.status === 'empty' ? (
          selectedDate === null ? (
            <ReleasesEmpty />
          ) : (
            <ReleaseDateEmpty date={selectedDate} onClearDate={handleClearDate} />
          )
        ) : (
          <>
            <ReleaseList exactDate={selectedDate !== null} response={state.response} />
            {selectedDate === null ? (
              <ReleaseLoadMore
                enabled={!calendarOpen}
                onLoadMore={loadMore}
                onRetry={retryMore}
                pagination={pagination}
              />
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
