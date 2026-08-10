import { describe, expect, it } from 'vitest';

import {
  compactPlatformLabel,
  desktopPlatformLabels,
  formatReleaseDate,
  formatReleaseStatus,
  getReleaseDayKind,
  groupReleasesByDate,
  platformLabel,
} from './release-presentation';

import type { ReleasesResponse } from '../../../../shared/contracts/releases';

type ReleaseItem = ReleasesResponse['data'][number];

function release(id: number, releaseDate: string, name: string): ReleaseItem {
  return {
    id,
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    coverUrl: null,
    releaseDate,
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
    genres: [],
  };
}

describe('release presentation', () => {
  it('groups every release by civil date without mutating the input', () => {
    const input = [release(2, '2026-08-11', 'B'), release(1, '2026-08-10', 'A')];
    const snapshot = structuredClone(input);

    expect(groupReleasesByDate(input)).toEqual([
      { releaseDate: '2026-08-10', items: [input[1]] },
      { releaseDate: '2026-08-11', items: [input[0]] },
    ]);
    expect(input).toEqual(snapshot);
  });

  it('derives today and tomorrow from the generated instant in São Paulo', () => {
    const generatedAt = '2026-08-11T01:30:00.000Z';

    expect(getReleaseDayKind('2026-08-10', generatedAt)).toBe('today');
    expect(getReleaseDayKind('2026-08-11', generatedAt)).toBe('tomorrow');
    expect(getReleaseDayKind('2026-08-12', generatedAt)).toBe('future');
  });

  it('formats civil dates without shifting the day', () => {
    expect(formatReleaseDate('2026-08-10')).toBe('10 de agosto de 2026');
    expect(formatReleaseDate('2026-08-10', false)).toBe('10 de agosto');
  });

  it('formats release status by whole civil-day distance', () => {
    const generatedAt = '2026-08-10T12:00:00.000Z';

    expect(formatReleaseStatus('2026-08-10', generatedAt)).toBe('Lança hoje');
    expect(formatReleaseStatus('2026-08-11', generatedAt)).toBe('Em 1 dia');
    expect(formatReleaseStatus('2026-08-13', generatedAt)).toBe('Em 3 dias');
  });

  it('uses abbreviations and summarizes excess platforms', () => {
    const platforms = [
      { id: 1, name: 'PC', abbreviation: 'PC' },
      { id: 2, name: 'PlayStation 5', abbreviation: 'PS5' },
      { id: 3, name: 'Xbox Series X|S', abbreviation: null },
    ];

    expect(desktopPlatformLabels(platforms)).toEqual(['PC', 'PS5', '+1']);
    expect(compactPlatformLabel(platforms)).toBe('PC • PS5 • +1');
  });

  it('falls back to the platform name when abbreviation is absent (catches fallback removal)', () => {
    expect(platformLabel({ id: 3, name: 'Xbox Series X|S', abbreviation: null })).toBe(
      'Xbox Series X|S',
    );
  });
});
