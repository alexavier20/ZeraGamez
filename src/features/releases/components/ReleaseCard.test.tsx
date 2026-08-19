import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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

    expect(desktop).toHaveClass('hidden', 'h-[407px]', 'sm:flex', 'sm:flex-col', 'sm:gap-2');
    expect(desktop).not.toHaveClass('overflow-hidden');
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

    const desktopPlatformRow = within(desktop).getByText('PC').parentElement;
    const desktopGenre = within(desktop).getByText('Ação RPG');
    expect(desktopGenre.parentElement).toBe(desktopPlatformRow);
    expect(desktopPlatformRow).toHaveClass('flex', 'min-w-0', 'items-center', 'gap-1.5');

    const desktopActions = within(desktop).getByRole('button', {
      name: 'Adicionar Eclipse Protocol à lista',
    }).parentElement;
    expect(desktopActions).toHaveClass('pt-2');

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

  it('uses stable platform identity when fallback labels are duplicated', () => {
    const duplicateLabel = 'Plataforma doméstica com um nome excepcionalmente comprido';
    const duplicatedPlatforms: ReleaseItem = {
      ...release,
      platforms: [
        { id: 200, name: duplicateLabel, abbreviation: null },
        { id: 201, name: duplicateLabel, abbreviation: null },
      ],
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={duplicatedPlatforms} />);

      expect(consoleError).not.toHaveBeenCalled();
      expect(
        within(screen.getByTestId('release-card-desktop-42')).getAllByText(duplicateLabel),
      ).toHaveLength(2);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('shrinks long textual chips while preserving titles, the summary, and the genre', () => {
    const firstPlatform = 'Plataforma doméstica com um nome excepcionalmente comprido';
    const secondPlatform = 'Outro dispositivo de entretenimento com nome ainda mais extenso';
    const longGenre = 'Aventura narrativa cinematográfica de mundo aberto';
    render(
      <ReleaseCard
        generatedAt="2026-08-10T12:00:00.000Z"
        item={{
          ...release,
          platforms: [
            { id: 200, name: firstPlatform, abbreviation: null },
            { id: 201, name: secondPlatform, abbreviation: null },
            { id: 202, name: 'Console portátil', abbreviation: null },
          ],
          genres: [{ id: 301, name: longGenre }],
        }}
      />,
    );

    const desktop = screen.getByTestId('release-card-desktop-42');
    for (const label of [firstPlatform, secondPlatform]) {
      expect(within(desktop).getByText(label)).toHaveAttribute('title', label);
      expect(within(desktop).getByText(label)).toHaveClass('min-w-0', 'shrink', 'truncate');
      expect(within(desktop).getByText(label)).not.toHaveClass('shrink-0');
    }
    expect(within(desktop).getByText('+1')).toHaveClass('shrink-0');
    expect(within(desktop).getByText(longGenre)).toHaveAttribute('title', longGenre);
    expect(within(desktop).getByText(longGenre)).toHaveClass(
      'min-w-[4rem]',
      'max-w-[40%]',
      'shrink',
      'truncate',
    );
  });

  it('keeps want-to-play and list actions available', () => {
    render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />);

    for (const layout of [
      screen.getByTestId('release-card-desktop-42'),
      screen.getByTestId('release-card-mobile-42'),
    ]) {
      expect(
        within(layout).getByRole('button', {
          name: 'Marcar Eclipse Protocol como quero jogar',
        }),
      ).toBeEnabled();
      expect(
        within(layout).getByRole('button', { name: 'Adicionar Eclipse Protocol à lista' }),
      ).toBeEnabled();
    }

    const icons = document.querySelectorAll('svg.lucide');
    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('omits the more-options action from desktop and mobile cards', () => {
    render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />);

    for (const layout of [
      screen.getByTestId('release-card-desktop-42'),
      screen.getByTestId('release-card-mobile-42'),
    ]) {
      expect(
        within(layout).queryByRole('button', { name: 'Mais opções para Eclipse Protocol' }),
      ).not.toBeInTheDocument();
    }
  });

  it('toggles want-to-play from either layout and keeps desktop and mobile in sync', async () => {
    const user = userEvent.setup();
    render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />);

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');
    const desktopButton = within(desktop).getByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });
    const mobileButton = within(mobile).getByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });

    expect(desktopButton).toHaveAttribute('aria-pressed', 'false');
    expect(mobileButton).toHaveAttribute('aria-pressed', 'false');
    expect(desktopButton).toHaveClass('h-7', 'w-[104px]', 'bg-app/80');
    expect(mobileButton).not.toHaveClass('w-[104px]');
    expect(within(desktopButton).getByText('Quero jogar!')).toBeInTheDocument();
    expect(within(mobileButton).queryByText('Quero jogar!')).not.toBeInTheDocument();
    expect(desktopButton.querySelector('svg.lucide-gamepad-2')).toBeInTheDocument();
    expect(mobileButton.querySelector('svg.lucide-gamepad-2')).toBeInTheDocument();

    await user.click(desktopButton);

    const selectedDesktopButton = within(desktop).getByRole('button', {
      name: 'Remover Eclipse Protocol de Quero jogar',
    });
    const selectedMobileButton = within(mobile).getByRole('button', {
      name: 'Remover Eclipse Protocol de Quero jogar',
    });
    for (const button of [selectedDesktopButton, selectedMobileButton]) {
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveClass('bg-success');
      expect(button.querySelector('svg.lucide-circle-check')).toBeInTheDocument();
    }

    await user.click(selectedMobileButton);

    const restoredDesktopButton = within(desktop).getByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });
    const restoredMobileButton = within(mobile).getByRole('button', {
      name: 'Marcar Eclipse Protocol como quero jogar',
    });
    for (const button of [restoredDesktopButton, restoredMobileButton]) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).not.toHaveClass('bg-success');
      expect(button.querySelector('svg.lucide-gamepad-2')).toBeInTheDocument();
      expect(button.querySelector('svg.lucide-circle-check')).not.toBeInTheDocument();
    }
  });

  it('opens one modal for the selected game and restores focus to its trigger on close', async () => {
    const user = userEvent.setup();
    render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />);

    const trigger = within(screen.getByTestId('release-card-desktop-42')).getByRole('button', {
      name: 'Adicionar Eclipse Protocol à lista',
    });
    await user.click(trigger);

    expect(
      screen.getByRole('dialog', { name: 'Adicionar Eclipse Protocol à lista' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Fechar modal' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
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
