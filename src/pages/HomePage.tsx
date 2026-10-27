import {
  ArrowRight,
  BookmarkPlus,
  CalendarDays,
  CirclePlay,
  Gamepad2,
  ListChecks,
} from 'lucide-react';
import { Link } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { MostAnticipatedSection } from '@/features/games/components/MostAnticipatedSection';
import { HomeReleaseCard } from '@/features/releases/components/HomeReleaseCard';
import { useReleases } from '@/features/releases/hooks/use-releases';
import { todayInSaoPaulo } from '@/features/releases/model/release-calendar';
import { headerRoutes } from '@/shared/components/header/header.config';

const features = [
  {
    eyebrow: 'Descubra',
    title: 'Lançamentos no radar',
    description: 'Explore os próximos jogos com calendário e filtros por plataforma e gênero.',
    icon: CalendarDays,
    label: 'Ver lançamentos',
    to: headerRoutes.releases,
  },
  {
    eyebrow: 'Organize',
    title: 'Listas do seu jeito',
    description:
      'Guarde os jogos que quer jogar, registre os que já zerou e crie suas próprias coleções.',
    icon: BookmarkPlus,
    label: 'Conhecer minhas listas',
    to: headerRoutes.lists,
  },
  {
    eyebrow: 'Explore',
    title: 'Mais sobre cada jogo',
    description:
      'Abra uma página de jogo para consultar imagens, gêneros, plataformas e avaliações.',
    icon: CirclePlay,
    label: 'Encontrar um jogo',
    to: headerRoutes.releases,
  },
] as const;

const dailyReleaseSkeletons = [0, 1, 2, 3, 4] as const;

const heroGames = [
  'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co5y83.jpg',
  'https://static.wikia.nocookie.net/forzamotorsport/images/f/f4/FH5_Boxart.jpg/revision/latest/scale-to-width-down/1200?cb=20210907183312',
  'https://www.igrandtheftauto.com/content/images/grand-theft-auto-vi-official-cover-art-hi-res.jpg',
  'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3p2d.jpg',
] as const;

function HeroArtwork() {
  return (
    <div
      aria-hidden="true"
      className="relative h-[240px] w-full overflow-hidden sm:h-[280px] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[55%]"
    >
      <div className="absolute inset-x-[12%] top-[8%] h-[76%] rounded-full bg-brand/20 blur-[90px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#ffffff0d_0%,_transparent_68%)]" />

      <div className="absolute inset-0 overflow-hidden">
        {heroGames.map((src, index) => (
          <div
            className="absolute inset-y-0 overflow-hidden bg-bg-secondary"
            key={src}
            style={{
              clipPath: 'polygon(20% 0, 100% 0, 80% 100%, 0 100%)',
              left: `${index * 25}%`,
              width: '32%',
            }}
          >
            <img
              alt=""
              className={`h-full w-full object-cover ${index === 2 ? 'scale-[1.15]' : ''}`}
              src={src}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyReleasesSection() {
  const { retry, state } = useReleases({ date: todayInSaoPaulo() });

  return (
    <section aria-labelledby="today-releases-title" className="pt-12 sm:pt-16">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-bright">
            No radar de hoje
          </p>
          <h2
            className="mt-2 font-heading text-2xl font-bold text-text-primary sm:text-3xl"
            id="today-releases-title"
          >
            Lançamentos do dia
          </h2>
        </div>
        <Link
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-content-primary transition hover:border-brand/50 hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to={headerRoutes.releases}
        >
          Ver mais
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>

      {state.status === 'loading' ? (
        <div
          aria-label="Carregando lançamentos do dia"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          role="status"
        >
          {dailyReleaseSkeletons.map((index) => (
            <div aria-hidden="true" className="min-w-0" key={index}>
              <div className="aspect-square animate-pulse rounded-xl bg-surface" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-surface" />
              <div className="mt-2 h-5 w-1/3 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
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
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {state.response.data.slice(0, 5).map((item) => (
            <li key={item.id}>
              <HomeReleaseCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HomePage() {
  const { state } = useAuth();
  const authenticated = state.status === 'authenticated';

  return (
    <main className="pb-28 sm:pb-16">
      <section
        aria-labelledby="home-title"
        className="relative isolate mx-auto mt-6 w-[calc(100%-2rem)] max-w-[1376px] overflow-hidden rounded-2xl bg-app shadow-[0_24px_80px_#0000004d] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)]"
      >
        <div
          aria-hidden="true"
          className="absolute -left-32 -top-40 size-[420px] rounded-full bg-brand/15 blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-44 right-[20%] size-[360px] rounded-full bg-[#4d1830]/20 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-0 hidden w-[45%] overflow-hidden lg:block"
        >
          <img
            alt=""
            className="h-full w-full object-fill"
            src="/assets/images/home-banner-background.png"
          />
          <img
            alt=""
            className="absolute left-[6%] top-[12%] w-[60%] max-w-[360px] object-contain"
            src="/assets/images/home-banner-logo.png"
          />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1440px] items-center gap-1 px-6 py-4 sm:px-10 sm:py-6 lg:min-h-[320px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-4 lg:px-10 lg:py-0 xl:px-[76px]">
          <div className="relative z-20 max-w-[580px] pb-1 lg:flex lg:min-h-[320px] lg:flex-col lg:justify-end lg:pb-8">
            <h1 className="sr-only" id="home-title">
              Zera GameZ
            </h1>
            <div
              aria-hidden="true"
              className="relative mb-5 aspect-[73/27] w-full overflow-hidden lg:hidden"
            >
              <img
                alt=""
                className="absolute inset-0 size-full object-fill"
                src="/assets/images/home-banner-background.png"
              />
              <img
                alt=""
                className="absolute left-[6%] top-[12%] w-[60%] max-w-[360px] object-contain"
                src="/assets/images/home-banner-logo.png"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-[0_8px_28px_#e7001240] transition hover:bg-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                to={headerRoutes.releases}
              >
                Explorar lançamentos
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-bold text-content-primary transition hover:border-white/30 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                to={authenticated ? headerRoutes.lists : '/entrar'}
              >
                {authenticated ? 'Abrir minhas listas' : 'Começar agora'}
                {authenticated ? (
                  <ListChecks aria-hidden="true" size={17} />
                ) : (
                  <ArrowRight aria-hidden="true" size={17} />
                )}
              </Link>
            </div>
          </div>
        </div>
        <HeroArtwork />
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <MostAnticipatedSection />
        <DailyReleasesSection />

        <section aria-labelledby="features-title" className="pt-12 sm:pt-16 lg:pt-[72px]">
          <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-bright">
                Do seu jeito
              </p>
              <h2
                className="mt-2 font-heading text-2xl font-bold text-text-primary sm:text-3xl"
                id="features-title"
              >
                Seu espaço para viver games
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ description, eyebrow, icon: Icon, label, title, to }) => (
              <Link
                className="group flex min-h-[230px] flex-col rounded-2xl border border-white/10 bg-surface p-5 transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-6"
                key={title}
                to={to}
              >
                <span className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand-bright">
                    <Icon aria-hidden="true" size={21} />
                  </span>
                  <span className="font-heading text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                    {eyebrow}
                  </span>
                </span>
                <h3 className="mt-6 font-heading text-xl font-bold text-content-primary">
                  {title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-text-muted">{description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-filter-active-text transition-colors group-hover:text-white">
                  {label}
                  <ArrowRight
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                    size={16}
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="cta-title"
          className="relative mt-12 overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-r from-[#291016] via-surface to-surface p-6 sm:mt-16 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8 lg:p-10"
        >
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-24 size-60 rounded-full bg-brand/15 blur-[75px]"
          />
          <div className="relative">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-bright">
              Pronto para começar?
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-text-primary" id="cta-title">
              Sua jornada gamer, do seu jeito.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted sm:text-base">
              Acesse sua conta para criar listas, salvar jogos e acompanhar o que está chegando.
            </p>
          </div>
          <Link
            className="relative mt-5 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:mt-0"
            to={authenticated ? headerRoutes.lists : '/entrar'}
          >
            {authenticated ? 'Ir para minhas listas' : 'Entrar ou criar conta'}
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </section>

        <footer className="flex flex-col gap-2 py-7 text-center text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span className="inline-flex items-center justify-center gap-2 sm:justify-start">
            <Gamepad2 aria-hidden="true" className="text-brand-bright" size={15} />
            Zera GameZ
          </span>
          <span>Uma plataforma para acompanhar, organizar e zerar.</span>
        </footer>
      </div>
    </main>
  );
}
