import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { headerRoutes } from '@/shared/components/header/header.config';

const slides = [
  { image: '/assets/images/home-hero-gta-vi.jpg', title: 'Grand Theft Auto VI' },
  {
    image: '/assets/images/home-hero-the-witcher-3-geralt-ciri.png',
    title: 'The Witcher 3: Wild Hunt',
  },
  { image: '/assets/images/home-hero-zelda.png', title: 'The Legend of Zelda' },
  { image: '/assets/images/home-hero-overwatch.png', title: 'Overwatch' },
] as const;

const ROTATION_INTERVAL_MS = 6000;
const controlClassName =
 'grid size-11 shrink-0 place-items-center rounded-full text-brand transition-colors hover:bg-brand-bright/30 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export function HomeHeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      setReducedMotion(preference.matches);
    };
    preference.addEventListener('change', updatePreference);
    return () => {
      preference.removeEventListener('change', updatePreference);
    };
  }, []);

  useEffect(() => {
    if (paused || hovered || reducedMotion) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) setActiveIndex((index) => (index + 1) % slides.length);
    }, ROTATION_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [paused, hovered, reducedMotion, activeIndex]);

  const changeSlide = (direction: number) => {
    setActiveIndex((index) => (index + direction + slides.length) % slides.length);
  };

  return (
    <section
      aria-label="Destaques do Zera GameZ"
      aria-roledescription="carrossel"
      className="relative isolate w-full overflow-hidden bg-surface"
      onFocusCapture={(event) => {
        if (!event.target.closest('[data-carousel-playback]')) setPaused(true);
      }}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <div aria-hidden="true" className="absolute inset-0">
        {slides.map((slide, index) => (
          <img
            alt=""
            className={`absolute inset-0 size-full object-cover ${index <= 1 ? 'object-top' : 'object-center'} transition-opacity duration-500 motion-reduce:transition-none ${index === activeIndex ? 'opacity-100' : 'opacity-0'}`}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            key={slide.image}
            src={slide.image}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-text-primary/85 via-text-primary/55 to-text-primary/20" />
      </div>

      <div className="site-container relative flex min-h-[250px] flex-col justify-center py-10 sm:min-h-[300px] lg:min-h-[350px]">
        <h1 className="max-w-2xl font-heading text-3xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
          Seu próximo jogo começa aqui
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
          Acompanhe os lançamentos, confira as notas da crítica e organize os jogos que estão no seu
          radar.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
      className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-hover hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            to={headerRoutes.releases}
          >
            Explorar lançamentos
            <ArrowRight aria-hidden="true" size={18} strokeWidth={1.75} />
          </Link>
          <Link
      className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:border-border hover:bg-brand-bright hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            to={headerRoutes.lists}
          >
            Organizar minhas listas
          </Link>
        </div>
      </div>

      <div className="relative border-t border-border bg-bg-secondary">
        <div className="site-container flex min-h-14 items-center justify-between gap-2">
          <button
            aria-label="Imagem anterior"
            className={controlClassName}
            onClick={() => {
              changeSlide(-1);
            }}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
          <div className="flex flex-col items-center gap-1 py-2">
            <p
              aria-live={paused || reducedMotion ? 'polite' : 'off'}
              aria-atomic="true"
              className="text-xs font-medium text-brand"
            >
              {slides[activeIndex].title}
            </p>
            <div aria-label="Escolher imagem" className="flex items-center">
              {slides.map((slide, index) => (
                <button
                  aria-label={`Mostrar imagem ${String(index + 1)}: ${slide.title}`}
                  aria-pressed={index === activeIndex}
                  className="grid size-6 place-items-center rounded focus-visible:outline-2 focus-visible:outline-brand"
                  key={slide.image}
                  onClick={() => {
                    setActiveIndex(index);
                  }}
                  type="button"
                >
                  <span
                    className={`h-1.5 w-5 rounded-full transition-colors duration-150 motion-reduce:transition-none ${index === activeIndex ? 'bg-brand-bright' : 'bg-brand-bright/40'}`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            {!reducedMotion && (
              <button
                aria-label={paused ? 'Retomar carrossel' : 'Pausar carrossel'}
                data-carousel-playback="true"
                className={controlClassName}
                onClick={() => {
                  setPaused((value) => !value);
                }}
                type="button"
              >
                {paused ? (
                  <Play aria-hidden="true" size={18} strokeWidth={1.5} />
                ) : (
                  <Pause aria-hidden="true" size={18} strokeWidth={1.5} />
                )}
              </button>
            )}
            <button
              aria-label="Próxima imagem"
              className={controlClassName}
              onClick={() => {
                changeSlide(1);
              }}
              type="button"
            >
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
