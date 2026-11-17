import { ArrowRight } from 'lucide-react';

import { MostAnticipatedSection } from '@/features/games/components/MostAnticipatedSection';
import { RecentReviewsSection } from '@/features/games/components/RecentReviewsSection';
import { SteamRankingsSection } from '@/features/games/components/SteamRankingsSection';
import { DailyReleasesCarousel } from '@/features/releases/components/DailyReleasesCarousel';
import { useReleases } from '@/features/releases/hooks/use-releases';
import { todayInSaoPaulo } from '@/features/releases/model/release-calendar';
import { headerRoutes } from '@/shared/components/header/header.config';
import { DiagonalSwipeButton } from '@/shared/components/DiagonalSwipeButton';
import { HomeCarouselSkeleton } from '@/shared/components/HomeCarouselSkeleton';
import { HomeFooter } from '@/shared/components/HomeFooter';
import { HomeHeroCarousel } from '@/shared/components/HomeHeroCarousel';
import { HomeSectionHeading } from '@/shared/components/HomeSectionHeading';

const HOME_DAILY_RELEASE_PREVIEW_LIMIT = 8;

function DailyReleasesSection() {
  const { retry, state } = useReleases({ date: todayInSaoPaulo() });

  return (
    <section aria-labelledby="today-releases-title" className="pt-10 sm:pt-14">
      <HomeSectionHeading
        action={
          <DiagonalSwipeButton size="compact" to={headerRoutes.releases}>
            Ver calendário
            <ArrowRight aria-hidden="true" size={18} strokeWidth={1.5} />
          </DiagonalSwipeButton>
        }
        id="today-releases-title"
        title="Lançamentos do dia"
      />

      {state.status === 'loading' ? (
        <HomeCarouselSkeleton variant="releases" />
      ) : state.status === 'error' ? (
        <div
          className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-8 text-center"
          role="alert"
        >
          <p className="text-sm text-red-700">Não foi possível carregar os lançamentos de hoje.</p>
          <button
            className="mt-4 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-800/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
            onClick={retry}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : state.response.data.length === 0 ? (
        <p
          className="rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-text-muted"
          role="status"
        >
          Nenhum jogo previsto para lançamento hoje. Confira os próximos dias em lançamentos.
        </p>
      ) : (
        <DailyReleasesCarousel
          items={state.response.data.slice(0, HOME_DAILY_RELEASE_PREVIEW_LIMIT)}
        />
      )}
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <main>
        <HomeHeroCarousel />

        <div className="site-container">
          <DailyReleasesSection />
          <RecentReviewsSection />
          <MostAnticipatedSection />
          <SteamRankingsSection />
        </div>
      </main>
      <HomeFooter />
    </>
  );
}
