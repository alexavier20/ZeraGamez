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
  ],
  genres: [{ id: 31, name: 'Ação RPG' }],
};

describe('ReleaseCard', () => {
  it('renders the contract fields and disabled visual actions in both layouts', () => {
    render(<ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={release} />);

    const desktop = screen.getByTestId('release-card-desktop-42');
    const mobile = screen.getByTestId('release-card-mobile-42');

    expect(within(desktop).getByText('Eclipse Protocol')).toBeInTheDocument();
    expect(within(desktop).getByText('10 de agosto de 2026')).toBeInTheDocument();
    expect(within(desktop).getByText('Lança hoje')).toBeInTheDocument();
    expect(within(desktop).getByText('Ação RPG')).toBeInTheDocument();
    expect(within(mobile).getByText('PC • PS5')).toBeInTheDocument();
    expect(
      within(desktop).getByRole('button', { name: 'Favoritar Eclipse Protocol' }),
    ).toBeDisabled();
    expect(
      within(desktop).getByRole('button', { name: 'Adicionar Eclipse Protocol à lista' }),
    ).toBeDisabled();
    expect(
      within(desktop).getByRole('button', { name: 'Mais opções para Eclipse Protocol' }),
    ).toBeDisabled();
  });

  it('renders an accessible cover placeholder when coverUrl is null', () => {
    render(
      <ReleaseCard generatedAt="2026-08-10T12:00:00.000Z" item={{ ...release, coverUrl: null }} />,
    );

    expect(
      screen.getAllByRole('img', { name: 'Capa indisponível de Eclipse Protocol' }),
    ).toHaveLength(2);
  });
});
