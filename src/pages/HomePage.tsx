import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { MostAnticipatedSection } from '@/features/games/components/MostAnticipatedSection';
import { RecentReviewsSection } from '@/features/games/components/RecentReviewsSection';
import { SteamRankingsSection } from '@/features/games/components/SteamRankingsSection';
import { DailyReleasesCarousel } from '@/features/releases/components/DailyReleasesCarousel';
import { useReleases } from '@/features/releases/hooks/use-releases';
import { todayInSaoPaulo } from '@/features/releases/model/release-calendar';
import { headerRoutes } from '@/shared/components/header/header.config';
import { HomeCarouselSkeleton } from '@/shared/components/HomeCarouselSkeleton';
import { HomeFooter } from '@/shared/components/HomeFooter';
import { HomeHeroCarousel } from '@/shared/components/HomeHeroCarousel';

const HOME_DAILY_RELEASE_PREVIEW_LIMIT = 8;

function DailyReleasesSection() {
  const { retry, state } = useReleases({ date: todayInSaoPaulo() });

  return (
    <section aria-labelledby="today-releases-title" className="pt-10 sm:pt-14">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="flex items-center gap-2 font-heading text-xl font-semibold text-text-primary sm:text-2xl"
            id="today-releases-title"
          >
            <span aria-hidden="true" className="h-6 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-brand" />
            Lançamentos do dia
          </h2>
        </div>
        <Link
          className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-brand-hover hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to={headerRoutes.releases}
        >
          Ver calendário completo
          <ArrowRight aria-hidden="true" size={18} strokeWidth={1.5} />
        </Link>
      </div>

      {state.status === 'loading' ? (
        <HomeCarouselSkeleton variant="releases" />
      ) : state.status === 'error' ? (
        <div
          className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-8 text-center"
          role="alert"
        >
          <p className="text-sm text-red-700">Não foi possível carregar os lançamentos de hoje.</p>
          <button
            className="mt-4 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
