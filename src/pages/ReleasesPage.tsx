import { PageHeading } from '@/shared/components/page-heading/PageHeading';

export function ReleasesPage() {
  return (
    <main
      aria-label="Lançamentos"
      className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pt-[22px] pb-28 sm:px-5 sm:pt-7 sm:pb-12 lg:px-8 lg:pt-9"
    >
      <PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
    </main>
  );
}
