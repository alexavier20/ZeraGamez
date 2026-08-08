// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { apiErrorResponseSchema, releasesResponseSchema } from './releases';

const validResponse = {
  data: [
    {
      id: 42,
      slug: 'eclipse-protocol',
      name: 'Eclipse Protocol',
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cover.jpg',
      releaseDate: '2026-08-08',
      platforms: [{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' }],
      genres: [{ id: 12, name: 'Role-playing (RPG)' }],
    },
  ],
  meta: {
    from: '2026-08-07',
    to: '2026-11-05',
    count: 1,
    limit: 50,
    generatedAt: '2026-08-07T12:00:00.000Z',
    sourceTruncated: false,
  },
};

describe('releasesResponseSchema', () => {
  it('aceita o DTO público aprovado', () => {
    expect(releasesResponseSchema.parse(validResponse)).toEqual(validResponse);
  });

  it('aceita datas civis de quatro dígitos antes de 0100', () => {
    const response = {
      ...validResponse,
      data: [{ ...validResponse.data[0], releaseDate: '0001-01-01' }],
      meta: { ...validResponse.meta, from: '0001-01-01', to: '0001-01-01' },
    };

    expect(releasesResponseSchema.parse(response)).toEqual(response);
  });

  it('rejeita data civil inválida e URL não HTTPS', () => {
    const invalid = {
      ...validResponse,
      data: [{ ...validResponse.data[0], releaseDate: '2026-02-30', coverUrl: 'http://cover' }],
    };

    expect(() => releasesResponseSchema.parse(invalid)).toThrow();
  });
});

describe('apiErrorResponseSchema', () => {
  it('rejeita códigos de erro não publicados', () => {
    expect(() =>
      apiErrorResponseSchema.parse({ error: { code: 'IGDB_SECRET', message: 'detalhes' } }),
    ).toThrow();
  });
});
