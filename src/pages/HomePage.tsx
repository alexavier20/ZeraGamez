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

function DailyReleasesSection() {
  const { retry, state } = useReleases({ date: todayInSaoPaulo() });

  return (
    <section aria-labelledby="today-releases-title" className="pt-10 sm:pt-14">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-bright">
            No radar de hoje
          </p>
          <h2
            className="mt-1 font-heading text-xl font-bold text-text-primary sm:text-2xl"
            id="today-releases-title"
          >
            Lançamentos do dia
          </h2>
        </div>
        <Link
          className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-content-primary transition hover:border-brand/50 hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to={headerRoutes.releases}
        >
          Ver mais
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>

      {state.status === 'loading' ? (
        <HomeCarouselSkeleton variant="releases" />
      ) : state.status === 'error' ? (
        <div
          className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-8 text-center"
          role="alert"
        >
          <p className="text-sm text-red-100">Não foi possível carregar os lançamentos de hoje.</p>
          <button
            className="mt-4 rounded-lg border border-red-200/30 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={retry}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : state.response.data.length === 0 ? (
        <p
          className="rounded-2xl border border-dashed border-white/15 bg-surface px-5 py-8 text-center text-sm text-text-muted"
          role="status"
        >
          Nenhum jogo previsto para lançamento hoje. Confira os próximos dias em lançamentos.
        </p>
      ) : (
        <DailyReleasesCarousel items={state.response.data} />
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
          <RecentReviewsSection />
          <MostAnticipatedSection />
          <DailyReleasesSection />
          <SteamRankingsSection />
        </div>
      </main>
      <HomeFooter />
    </>
  );
}
