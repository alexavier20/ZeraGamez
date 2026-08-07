// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { consolidateReleases, type CandidateRelease } from './release';

function candidate(overrides: Partial<CandidateRelease> = {}): CandidateRelease {
  return {
    game: {
      id: 1,
      slug: 'game',
      name: 'Game',
      coverUrl: null,
      genres: [{ id: 12, name: 'RPG' }],
    },
    platform: { id: 6, name: 'PC', abbreviation: 'PC' },
    releaseDate: '2026-08-10',
    region: 'worldwide',
    ...overrides,
  };
}

describe('consolidateReleases', () => {
  it('prioriza Brasil por jogo e plataforma mesmo quando a data mundial é anterior', () => {
    const result = consolidateReleases(
      [
        candidate({ releaseDate: '2026-08-08', region: 'worldwide' }),
        candidate({ releaseDate: '2026-08-10', region: 'brazil' }),
      ],
      50,
    );

    expect(result[0]?.releaseDate).toBe('2026-08-10');
  });

  it('reúne plataformas da menor data selecionada e ignora plataformas posteriores', () => {
    const result = consolidateReleases(
      [
        candidate(),
        candidate({
          platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
          region: 'brazil',
        }),
        candidate({
          platform: { id: 169, name: 'Xbox Series X|S', abbreviation: 'Series' },
          releaseDate: '2026-08-12',
          region: 'brazil',
        }),
      ],
      50,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.platforms.map(({ id }) => id)).toEqual([6, 167]);
  });

  it('deduplica plataformas repetidas do mesmo jogo', () => {
    const result = consolidateReleases([candidate(), candidate()], 50);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Game');
    expect(result[0]?.platforms.map(({ id }) => id)).toEqual([6]);
  });

  it('deduplica, ordena deterministicamente e aplica limite depois de consolidar', () => {
    const secondGame = candidate({
      game: { id: 2, slug: 'alpha', name: 'Alpha', coverUrl: null, genres: [] },
    });

    const input = [candidate(), candidate(), secondGame];
    const snapshot = structuredClone(input);
    const result = consolidateReleases(input, 1);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Alpha');
    expect(input).toEqual(snapshot);
  });
});
