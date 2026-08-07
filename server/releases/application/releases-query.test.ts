// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { InvalidQueryError, parseReleasesQuery } from './releases-query';

const clock = { now: () => new Date('2026-08-08T02:30:00.000Z') };

describe('parseReleasesQuery', () => {
  it('usa a data de São Paulo, 90 dias e limite 50 como defaults', () => {
    expect(parseReleasesQuery(new URLSearchParams(), clock)).toEqual({
      from: '2026-08-07',
      to: '2026-11-05',
      limit: 50,
      platformIds: [],
      genreIds: [],
    });
  });

  it('aceita período, limite, plataformas e gêneros válidos', () => {
    expect(
      parseReleasesQuery(
        new URLSearchParams('from=2026-08-10&to=2026-08-20&limit=25&platforms=6,167&genres=12'),
        clock,
      ),
    ).toEqual({
      from: '2026-08-10',
      to: '2026-08-20',
      limit: 25,
      platformIds: [6, 167],
      genreIds: [12],
    });
  });

  it.each([
    'from=2026-02-30',
    'from=2026-08-10&to=2026-08-09',
    'from=2026-01-01&to=2027-01-03',
    'limit=0',
    'limit=101',
    'limit=abc',
    'platforms=6,6',
    'genres=0',
    'limit=1&limit=2',
    'unknown=1',
  ])('rejeita query inválida: %s', (query) => {
    expect(() => parseReleasesQuery(new URLSearchParams(query), clock)).toThrow(InvalidQueryError);
  });
});
