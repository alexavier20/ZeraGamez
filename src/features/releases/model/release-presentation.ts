import type { ReleasesResponse } from '../../../../shared/contracts/releases';

export type ReleaseItem = ReleasesResponse['data'][number];

export interface ReleaseGroup {
  readonly releaseDate: string;
  readonly items: readonly ReleaseItem[];
}

export type ReleaseDayKind = 'today' | 'tomorrow' | 'future';

const sectionFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const cardFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const saoPauloParts = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

function civilDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function generatedCivilDate(value: string) {
  const parts = Object.fromEntries(
    saoPauloParts.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function daysBetween(from: string, to: string) {
  return Math.round((civilDate(to).getTime() - civilDate(from).getTime()) / 86_400_000);
}

export function groupReleasesByDate(items: readonly ReleaseItem[]): ReleaseGroup[] {
  const groups = new Map<string, ReleaseItem[]>();
  for (const item of items) {
    const group = groups.get(item.releaseDate);
    if (group) group.push(item);
    else groups.set(item.releaseDate, [item]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([releaseDate, groupedItems]) => ({ releaseDate, items: groupedItems }));
}

export function getReleaseDayKind(releaseDate: string, generatedAt: string): ReleaseDayKind {
  const difference = daysBetween(generatedCivilDate(generatedAt), releaseDate);

  if (difference === 0) return 'today';
  if (difference === 1) return 'tomorrow';
  return 'future';
}

export function formatReleaseDate(releaseDate: string, includeYear = true): string {
  return (includeYear ? cardFormatter : sectionFormatter).format(civilDate(releaseDate));
}

export function formatReleaseStatus(releaseDate: string, generatedAt: string): string {
  const difference = daysBetween(generatedCivilDate(generatedAt), releaseDate);

  if (difference === 0) return 'Lança hoje';
  if (difference === 1) return 'Em 1 dia';
  return `Em ${String(difference)} dias`;
}

export function platformLabel(platform: ReleaseItem['platforms'][number]): string {
  return platform.abbreviation ?? platform.name;
}

export function desktopPlatformLabels(
  platforms: readonly ReleaseItem['platforms'][number][],
): string[] {
  const labels = platforms.slice(0, 2).map(platformLabel);
  const remaining = platforms.length - labels.length;

  return remaining > 0 ? [...labels, `+${String(remaining)}`] : labels;
}

export function compactPlatformLabel(
  platforms: readonly ReleaseItem['platforms'][number][],
): string {
  return desktopPlatformLabels(platforms).join(' • ');
}
