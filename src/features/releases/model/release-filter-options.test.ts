import { describe, expect, it } from 'vitest';

import {
  defaultReleaseFilterSelection,
  releaseGenreOptions,
  releasePlatformOptions,
  toReleaseFilterIds,
} from './release-filter-options';

describe('release filter options', () => {
  it('exposes the approved fixed platform and genre catalogs', () => {
    expect(releasePlatformOptions).toEqual([
      { key: 'all', label: 'Todas as plataformas', ids: [] },
      { key: 'pc', label: 'PC', ids: [6] },
      { key: 'ps5', label: 'PlayStation 5', ids: [167] },
      { key: 'xbox-series', label: 'Xbox Series X|S', ids: [169] },
      { key: 'switch', label: 'Nintendo Switch', ids: [130] },
    ]);
    expect(releaseGenreOptions).toEqual([
      { key: 'all', label: 'Todos os gêneros', ids: [] },
      { key: 'action', label: 'Ação', ids: [4, 25] },
      { key: 'adventure', label: 'Aventura', ids: [31] },
      { key: 'rpg', label: 'RPG', ids: [12] },
      { key: 'strategy', label: 'Estratégia', ids: [15] },
      { key: 'shooter', label: 'Tiro', ids: [5] },
      { key: 'indie', label: 'Indie', ids: [32] },
    ]);
  });

  it('converts one platform and one genre selection to copied request IDs', () => {
    const ids = toReleaseFilterIds({ platform: 'ps5', genre: 'action' });

    expect(ids).toEqual({ platformIds: [167], genreIds: [4, 25] });
    expect(ids.platformIds).not.toBe(releasePlatformOptions[2].ids);
    expect(ids.genreIds).not.toBe(releaseGenreOptions[1].ids);
    expect(toReleaseFilterIds(defaultReleaseFilterSelection)).toEqual({
      platformIds: [],
      genreIds: [],
    });
  });
});
