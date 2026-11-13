import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { ReactNode } from 'react';

export function HorizontalGameCarousel({
  children,
  label,
  previousLabel,
  nextLabel,
}: Readonly<{ children: ReactNode; label: string; previousLabel: string; nextLabel: string }>) {
  const itemKeys = Children.toArray(children)
    .map((child) => (isValidElement(child) ? child.key : null))
    .join('|');
  const stripId = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  function updateEdges() {
    const strip = stripRef.current;
    if (!strip) return;
    setEdges({
      start: strip.scrollLeft <= 1,
      end: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1,
    });
  }

  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollLeft = 0;
    updateEdges();
  }, [itemKeys]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    updateEdges();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges);
    observer?.observe(strip);
    if (strip.firstElementChild) observer?.observe(strip.firstElementChild);
    window.addEventListener('resize', updateEdges);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateEdges);
    };
  }, [children]);

  function scroll(direction: -1 | 1) {
    const strip = stripRef.current;
    if (!strip) return;
    const cardWidth = strip.querySelector('li')?.getBoundingClientRect().width ?? 160;
    const step = cardWidth + 16;
    const visibleCards = Math.max(1, Math.floor(strip.clientWidth / step));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollBy({
      left: direction * visibleCards * step,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  const buttonClass =
    'absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-bg-secondary/95 text-text-primary transition-colors duration-150 hover:border-border hover:bg-brand-bright/30 disabled:cursor-default disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-bg-secondary/95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <div className="relative">
      <div
        ref={stripRef}
        id={stripId}
        aria-label={label}
        className="snap-x snap-proximity scroll-px-1 overflow-x-auto overscroll-x-contain px-1 pt-1 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        role="region"
        onScroll={updateEdges}
      >
        <ul className="flex list-none gap-4 p-0">{children}</ul>
      </div>
      {!(edges.start && edges.end) && (
        <>
          <button
            type="button"
            aria-label={previousLabel}
            aria-controls={stripId}
            disabled={edges.start}
            className={`${buttonClass} left-0`}
            onClick={() => {
              scroll(-1);
            }}
          >
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label={nextLabel}
            aria-controls={stripId}
            disabled={edges.end}
            className={`${buttonClass} right-0`}
            onClick={() => {
              scroll(1);
            }}
          >
            <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
        </>
      )}
    </div>
  );
}
