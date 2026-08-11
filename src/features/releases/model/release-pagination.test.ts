import { describe, expect, it } from 'vitest';

import {
  addCivilDays,
  createReleaseHorizon,
  isReleaseWindowIncomplete,
  mergeReleaseResponses,
  nextReleaseWindow,
  splitReleaseWindow,
} from './release-pagination';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

function response(
  data: ReleasesResponse['data'],
  overrides: Partial<ReleasesResponse['meta']> = {},
): ReleasesResponse {
  return {
    data,
    meta: {
      from: '2026-08-11',
      to: '2026-11-09',
      count: data.length,
      limit: 100,
      generatedAt: '2026-08-11T12:00:00.000Z',
      sourceTruncated: false,
      ...overrides,
    },
  };
}

function release(
  id: number,
  releaseDate: string,
  name = `Game ${String(id)}`,
): ReleasesResponse['data'][number] {
  return {
    id,
    slug: `game-${String(id)}`,
    name,
    coverUrl: null,
    releaseDate,
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
    genres: [],
  };
}

describe('release pagination windows', () => {
  it('uses UTC civil arithmetic across month and leap-year boundaries', () => {
    expect(addCivilDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(addCivilDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('rejects impossible civil dates before doing UTC arithmetic', () => {
    expect(() => addCivilDays('2027-02-29', 1)).toThrow();
  });

  it('creates consecutive windows capped by the inclusive two-year horizon', () => {
    const horizon = createReleaseHorizon('2026-08-11');

    expect(horizon).toBe('2028-08-10');
    expect(nextReleaseWindow('2026-11-09', horizon)).toEqual({
      from: '2026-11-10',
      to: '2027-02-08',
    });
    expect(nextReleaseWindow('2028-08-10', horizon)).toBeNull();
    expect(nextReleaseWindow('2028-08-09', horizon)).toEqual({
      from: '2028-08-10',
      to: '2028-08-10',
    });
    expect(() => nextReleaseWindow('2026-11-09', '2027-02-29')).toThrow();
  });

  it('splits odd and even spans without a gap or overlap', () => {
    expect(splitReleaseWindow({ from: '2026-08-01', to: '2026-08-10' })).toEqual([
      { from: '2026-08-01', to: '2026-08-05' },
      { from: '2026-08-06', to: '2026-08-10' },
    ]);
    expect(splitReleaseWindow({ from: '2026-08-01', to: '2026-08-11' })).toEqual([
      { from: '2026-08-01', to: '2026-08-06' },
      { from: '2026-08-07', to: '2026-08-11' },
    ]);
    expect(splitReleaseWindow({ from: '2026-08-01', to: '2026-08-01' })).toBeNull();
  });

  it('classifies public-limit and raw-source truncation as incomplete', () => {
    expect(isReleaseWindowIncomplete(response([], { count: 100 }))).toBe(true);
    expect(isReleaseWindowIncomplete(response([], { sourceTruncated: true }))).toBe(true);
    expect(isReleaseWindowIncomplete(response([], { count: 99 }))).toBe(false);
  });

  it('merges chronologically without mutating inputs or duplicating game/date keys', () => {
    const first = response([release(2, '2026-08-12'), release(1, '2026-08-11')]);
    const second = response(
      [release(1, '2026-08-11'), release(1, '2026-11-11'), release(3, '2026-12-01')],
      {
        from: '2026-11-10',
        to: '2027-02-08',
        generatedAt: '2026-08-11T13:00:00.000Z',
      },
    );
    const firstSnapshot = structuredClone(first);
    const secondSnapshot = structuredClone(second);

    const merged = mergeReleaseResponses(first, second);

    expect(merged.data.map(({ id }) => id)).toEqual([1, 2, 1, 3]);
    expect(merged.meta).toMatchObject({
      from: '2026-08-11',
      to: '2027-02-08',
      count: 4,
      limit: 100,
      generatedAt: '2026-08-11T12:00:00.000Z',
      sourceTruncated: false,
    });
    expect(first).toEqual(firstSnapshot);
    expect(second).toEqual(secondSnapshot);
  });
});
