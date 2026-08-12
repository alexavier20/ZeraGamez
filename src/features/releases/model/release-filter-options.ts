export const releasePlatformOptions = [
  { key: 'all', label: 'Todas as plataformas', ids: [] },
  { key: 'pc', label: 'PC', ids: [6] },
  { key: 'ps5', label: 'PlayStation 5', ids: [167] },
  { key: 'xbox-series', label: 'Xbox Series X|S', ids: [169] },
  { key: 'switch', label: 'Nintendo Switch', ids: [130] },
] as const;

export const releaseGenreOptions = [
  { key: 'all', label: 'Todos os gêneros', ids: [] },
  { key: 'action', label: 'Ação', ids: [4, 25] },
  { key: 'adventure', label: 'Aventura', ids: [31] },
  { key: 'rpg', label: 'RPG', ids: [12] },
  { key: 'strategy', label: 'Estratégia', ids: [15] },
  { key: 'shooter', label: 'Tiro', ids: [5] },
  { key: 'indie', label: 'Indie', ids: [32] },
] as const;

export type ReleasePlatformFilterKey = (typeof releasePlatformOptions)[number]['key'];
export type ReleaseGenreFilterKey = (typeof releaseGenreOptions)[number]['key'];

export interface ReleaseFilterSelection {
  readonly platform: ReleasePlatformFilterKey;
  readonly genre: ReleaseGenreFilterKey;
}

export interface ReleaseFilterIds {
  readonly platformIds: number[];
  readonly genreIds: number[];
}

export const defaultReleaseFilterSelection = {
  platform: 'all',
  genre: 'all',
} as const satisfies ReleaseFilterSelection;

export function toReleaseFilterIds(selection: ReleaseFilterSelection): ReleaseFilterIds {
  const platform = releasePlatformOptions.find(({ key }) => key === selection.platform);
  const genre = releaseGenreOptions.find(({ key }) => key === selection.genre);

  if (!platform || !genre) throw new Error('Invalid release filter selection');

  return { platformIds: [...platform.ids], genreIds: [...genre.ids] };
}
