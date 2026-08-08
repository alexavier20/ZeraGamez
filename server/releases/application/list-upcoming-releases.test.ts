// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { listUpcomingReleases, type Clock, type ReleaseRepository } from './list-upcoming-releases';

import type { ReleaseQuery } from './releases-query';
import type { CandidateRelease } from '../domain/release';

const query: ReleaseQuery = {
  from: '2026-08-07',
  to: '2026-11-05',
  limit: 1,
  platformIds: [],
  genreIds: [],
};
const clock: Clock = { now: () => new Date('2026-08-07T12:00:00.000Z') };
const candidates: CandidateRelease[] = [
  {
    game: { id: 2, slug: 'zeta', name: 'Zeta', coverUrl: null, genres: [] },
    platform: { id: 6, name: 'PC', abbreviation: 'PC' },
    releaseDate: '2026-08-08',
    region: 'worldwide',
  },
  {
    game: { id: 1, slug: 'alpha', name: 'Alpha', coverUrl: null, genres: [] },
    platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
    releaseDate: '2026-08-08',
    region: 'brazil',
  },
];

describe('listUpcomingReleases', () => {
  it('consulta a porta, consolida e cria os metadados públicos', async () => {
    const findUpcoming = vi.fn<ReleaseRepository['findUpcoming']>().mockResolvedValue({
      candidates,
      sourceTruncated: true,
    });

    const response = await listUpcomingReleases(query, {
      clock,
      repository: { findUpcoming },
    });

    expect(findUpcoming).toHaveBeenCalledWith(query);
    expect(response.data.map(({ name }) => name)).toEqual(['Alpha']);
    expect(response.meta).toEqual({
      from: query.from,
      to: query.to,
      count: 1,
      limit: 1,
      generatedAt: '2026-08-07T12:00:00.000Z',
      sourceTruncated: true,
    });
  });
});
