import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DailyReleasesCarousel } from './DailyReleasesCarousel';

import type { ReleaseItem } from '@/features/releases/model/release-presentation';

const items: ReleaseItem[] = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  slug: `jogo-${String(index)}`,
  name: `Jogo ${String(index)}`,
  coverUrl: null,
  releaseDate: '2026-11-04',
  platforms: [],
  genres: [],
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderCarousel(reduceMotion = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduceMotion })),
  );
  const view = render(
    <MemoryRouter>
      <DailyReleasesCarousel items={items} />
    </MemoryRouter>,
  );
  const strip = screen.getByRole('region', { name: /Lançamentos do dia/ });
  const scrollBy = vi.fn();
  Object.defineProperties(strip, {
    clientWidth: { configurable: true, value: 400 },
    scrollWidth: { configurable: true, value: 1200 },
    scrollLeft: { configurable: true, writable: true, value: 0 },
    scrollBy: { configurable: true, value: scrollBy },
  });
  vi.spyOn(screen.getAllByRole('listitem')[0], 'getBoundingClientRect').mockReturnValue({
    width: 176,
    height: 300,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 176,
    bottom: 300,
    toJSON: () => ({}),
  });
  fireEvent(window, new Event('resize'));
  return { strip, scrollBy, rerender: view.rerender };
}

describe('DailyReleasesCarousel', () => {
  it('rola nos dois sentidos e desabilita os botões nas extremidades', async () => {
    const user = userEvent.setup();
    const { strip, scrollBy } = renderCarousel();
    const previous = screen.getByRole('button', { name: 'Ver lançamentos anteriores' });
    const next = screen.getByRole('button', { name: 'Ver próximos lançamentos' });
    expect(previous).toBeDisabled();
    await user.click(next);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 384, behavior: 'smooth' });

    strip.scrollLeft = 800;
    fireEvent.scroll(strip);
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();
    await user.click(previous);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -384, behavior: 'smooth' });

    strip.scrollLeft = 0;
    Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 1200 });
    fireEvent(window, new Event('resize'));
    expect(
      screen.queryByRole('button', { name: 'Ver próximos lançamentos' }),
    ).not.toBeInTheDocument();
  });

  it('mantém a posição ao renderizar novamente e volta ao início ao carregar outros jogos', () => {
    const { strip, rerender } = renderCarousel();
    expect(strip.scrollLeft).toBe(0);
    expect(strip).toHaveClass('scroll-px-1');
    expect(screen.getByRole('button', { name: 'Ver lançamentos anteriores' })).toBeDisabled();

    strip.scrollLeft = 384;
    fireEvent.scroll(strip);
    expect(screen.getByRole('button', { name: 'Ver lançamentos anteriores' })).toBeEnabled();

    rerender(
      <MemoryRouter>
        <DailyReleasesCarousel items={[...items]} />
      </MemoryRouter>,
    );
    expect(strip.scrollLeft).toBe(384);

    rerender(
      <MemoryRouter>
        <DailyReleasesCarousel items={items.map((item) => ({ ...item, id: item.id + 100 }))} />
      </MemoryRouter>,
    );
    expect(strip.scrollLeft).toBe(0);
    expect(screen.getByRole('button', { name: 'Ver lançamentos anteriores' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ver próximos lançamentos' })).toBeEnabled();
  });

  it('respeita a preferência de reduzir movimento', async () => {
    const user = userEvent.setup();
    const { scrollBy } = renderCarousel(true);
    await user.click(screen.getByRole('button', { name: 'Ver próximos lançamentos' }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 384, behavior: 'auto' });
  });
});
