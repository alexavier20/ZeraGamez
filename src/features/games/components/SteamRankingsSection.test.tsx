import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSteamRanking } from '@/features/games/api/game-search-client';

import { SteamRankingsSection } from './SteamRankingsSection';

vi.mock('@/features/games/api/game-search-client', () => ({ getSteamRanking: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe('SteamRankingsSection', () => {
  it('exibe cinco posições em cada categoria com links para os detalhes', async () => {
    vi.mocked(getSteamRanking).mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        name: `Game ${String(index + 1)}`,
        coverUrl: null,
        releaseDate: null,
        platforms: [],
        steamRankingValue: 0.1857196054,
      })),
    );
    render(
      <MemoryRouter>
        <SteamRankingsSection />
      </MemoryRouter>,
    );
    expect(await screen.findAllByText('Game 1')).toHaveLength(3);
    for (const title of ['Pico de jogadores', 'Avaliações positivas', 'Mais vendidos']) {
      const panel = screen.getByRole('region', { name: title });
      expect(within(panel).getAllByRole('listitem')).toHaveLength(5);
      expect(within(panel).queryByText(/0,185720/)).not.toBeInTheDocument();
      expect(within(panel).getAllByRole('link')[4]).toHaveAttribute('href', '/jogos/5');
    }
  });

  it('permite tentar novamente uma categoria sem bloquear as demais', async () => {
    vi.mocked(getSteamRanking).mockImplementation((metric) =>
      metric === 'peak-players' ? Promise.reject(new Error('offline')) : Promise.resolve([]),
    );
    render(
      <MemoryRouter>
        <SteamRankingsSection />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar este ranking.',
    );
    expect(await screen.findAllByText('Nenhum jogo disponível neste ranking.')).toHaveLength(2);
    vi.mocked(getSteamRanking).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => {
      expect(screen.getAllByText('Nenhum jogo disponível neste ranking.')).toHaveLength(3);
    });
    expect(getSteamRanking).toHaveBeenCalledTimes(4);
  });
});
