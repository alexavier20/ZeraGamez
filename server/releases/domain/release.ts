import type { ReleasesResponse } from '../../../shared/contracts/releases';

export type ReleaseItem = ReleasesResponse['data'][number];

export interface CandidateRelease {
  game: Omit<ReleaseItem, 'releaseDate' | 'platforms'>;
  platform: ReleaseItem['platforms'][number];
  releaseDate: string;
  region: 'brazil' | 'worldwide';
}

function compareName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name, 'pt-BR');
}

function preferCandidate(current: CandidateRelease | undefined, next: CandidateRelease) {
  if (!current) return next;
  if (current.region !== next.region) return next.region === 'brazil' ? next : current;
  return next.releaseDate < current.releaseDate ? next : current;
}

export function consolidateReleases(candidates: readonly CandidateRelease[], limit: number) {
  const byGameAndPlatform = new Map<string, CandidateRelease>();

  for (const candidate of candidates) {
    const key = String(candidate.game.id) + ':' + String(candidate.platform.id);
    byGameAndPlatform.set(key, preferCandidate(byGameAndPlatform.get(key), candidate));
  }

  const byGame = new Map<number, CandidateRelease[]>();
  for (const candidate of byGameAndPlatform.values()) {
    const entries = byGame.get(candidate.game.id) ?? [];
    entries.push(candidate);
    byGame.set(candidate.game.id, entries);
  }

  const releases: ReleaseItem[] = [];
  for (const entries of byGame.values()) {
    const firstEntry = entries.at(0);
    if (!firstEntry) continue;
    const releaseDate = entries.reduce(
      (earliest, entry) => (entry.releaseDate < earliest ? entry.releaseDate : earliest),
      firstEntry.releaseDate,
    );
    const selected = entries.filter((entry) => entry.releaseDate === releaseDate);
    const selectedEntry = selected.at(0);
    if (!selectedEntry) continue;
    const game = selectedEntry.game;
    const platforms = [
      ...new Map(selected.map(({ platform }) => [platform.id, platform])).values(),
    ];
    const genres = [...new Map(game.genres.map((genre) => [genre.id, genre])).values()];

    releases.push({
      ...game,
      genres: genres.sort(compareName),
      platforms: platforms.sort(compareName),
      releaseDate,
    });
  }

  return releases
    .sort(
      (left, right) =>
        left.releaseDate.localeCompare(right.releaseDate) || compareName(left, right),
    )
    .slice(0, limit);
}
