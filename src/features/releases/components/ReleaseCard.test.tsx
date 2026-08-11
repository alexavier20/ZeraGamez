import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseCard } from '@/features/releases/components/ReleaseCard';

import type { ReleaseItem } from '@/features/releases/model/release-presentation';

const release: ReleaseItem = {
  id: 42,
  slug: 'eclipse-protocol',
  name: 'Eclipse Protocol',
  coverUrl: 'https://images.example.com/eclipse-protocol.jpg',
  releaseDate: '2026-08-10',
  platforms: [
    { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
    { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
    { id: 169, name: 'Xbox Series X|S', abbreviation: null },
  ],
  genres: [{ id: 31, name: 'Ação RPG' }],
};

describe('ReleaseCard', () => {
  it('keeps CSS-selected desktop and mobile facades with their distinct cover geometry', () => {
    render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />);

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');

    expect(desktop).toHaveClass('hidden', 'sm:flex', 'sm:flex-col');
    expect(mobile).toHaveClass('grid', 'grid-cols-[82px_minmax(0,1fr)]', 'sm:hidden');

    const desktopCover = within(desktop).getByRole('img', { name: 'Capa de Eclipse Protocol' });
    const mobileCover = within(mobile).getByRole('img', { name: 'Capa de Eclipse Protocol' });

    expect(desktopCover).toHaveAttribute('loading', 'lazy');
    expect(desktopCover).toHaveClass('h-[244px]', 'w-full', 'object-cover');
    expect(desktopCover).not.toHaveClass('aspect-square');
    expect(mobileCover).toHaveAttribute('loading', 'lazy');
    expect(mobileCover).toHaveClass('h-full', 'w-[82px]', 'object-cover');
  });

  it('renders constrained metadata with full values available through titles', () => {
    const { rerender } = render(
      <ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />,
    );

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');

    expect(within(desktop).getByText('10 de agosto de 2026')).toBeInTheDocument();
    expect(within(desktop).getByText('Lança hoje')).toBeInTheDocument();
    expect(within(desktop).getByText('Ação RPG')).toBeInTheDocument();
    expect(within(desktop).getByText('PC')).toBeInTheDocument();
    expect(within(desktop).getByText('PS5')).toBeInTheDocument();
    expect(within(desktop).getByText('+1')).toBeInTheDocument();
    expect(within(mobile).getByText('PC • PS5 • +1')).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { name: 'Eclipse Protocol' });
    expect(headings).toHaveLength(2);
    for (const heading of headings) {
      expect(heading).toHaveAttribute('title', 'Eclipse Protocol');
    }
    expect(within(mobile).getByText('PC • PS5 • +1')).toHaveAttribute('title', 'PC • PS5 • +1');
    for (const genre of screen.getAllByText('Ação RPG')) {
      expect(genre).toHaveAttribute('title', 'Ação RPG');
    }
    expect(within(mobile).getByText('10 de agosto de 2026')).toHaveAttribute(
      'title',
      '10 de agosto de 2026',
    );

    rerender(
      <ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={{ ...release, genres: [] }} />,
    );

    expect(screen.queryByText('Ação RPG')).not.toBeInTheDocument();
  });

  it('keeps named visual actions disabled and decorative icons out of the accessibility tree', () => {
    render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />);

    for (const layout of [
      screen.getByTestId('release-card-desktop-42'),
      screen.getByTestId('release-card-mobile-42'),
    ]) {
      expect(
        within(layout).getByRole('button', { name: 'Favoritar Eclipse Protocol' }),
      ).toBeDisabled();
      expect(
        within(layout).getByRole('button', { name: 'Adicionar Eclipse Protocol à lista' }),
      ).toBeDisabled();
      expect(
        within(layout).getByRole('button', { name: 'Mais opções para Eclipse Protocol' }),
      ).toBeDisabled();
    }

    const icons = document.querySelectorAll('svg.lucide');
    expect(icons).toHaveLength(6);
    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders accessible desktop and mobile placeholders with decorative gamepad icons', () => {
    render(
      <ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={{ ...release, coverUrl: null }} />,
    );

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');
    const desktopPlaceholder = within(desktop).getByRole('img', {
      name: 'Capa indisponível de Eclipse Protocol',
    });
    const mobilePlaceholder = within(mobile).getByRole('img', {
      name: 'Capa indisponível de Eclipse Protocol',
    });

    expect(desktopPlaceholder).toHaveClass('h-[244px]', 'w-full');
    expect(desktopPlaceholder).not.toHaveClass('aspect-square');
    expect(mobilePlaceholder).toHaveClass('h-full', 'w-[82px]');
    expect(desktopPlaceholder.querySelector('svg.lucide-gamepad-2')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(mobilePlaceholder.querySelector('svg.lucide-gamepad-2')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
