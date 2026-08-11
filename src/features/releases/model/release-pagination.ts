import {
  releasesResponseSchema,
  type ReleasesResponse,
} from '../../../../shared/contracts/releases';

export const PAGE_LIMIT = 100;
export const WINDOW_SPAN_DAYS = 90;
export const HORIZON_DAYS = 730;

export interface ReleaseWindow {
  readonly from: string;
  readonly to: string;
}

const DAY_MS = 86_400_000;

function civilTimestamp(value: string): number {
  const civilDate = releasesResponseSchema.shape.meta.shape.from.parse(value);
  return Date.parse(`${civilDate}T00:00:00.000Z`);
}

export function addCivilDays(value: string, days: number): string {
  return new Date(civilTimestamp(value) + days * DAY_MS).toISOString().slice(0, 10);
}

export function createReleaseHorizon(initialFrom: string): string {
  return addCivilDays(initialFrom, HORIZON_DAYS);
}

export function nextReleaseWindow(after: string, horizon: string): ReleaseWindow | null {
  const validatedHorizon = releasesResponseSchema.shape.meta.shape.to.parse(horizon);
  const from = addCivilDays(after, 1);
  if (from > validatedHorizon) return null;
  const candidateTo = addCivilDays(from, WINDOW_SPAN_DAYS);
  return { from, to: candidateTo < validatedHorizon ? candidateTo : validatedHorizon };
}

export function splitReleaseWindow(
  window: ReleaseWindow,
): readonly [ReleaseWindow, ReleaseWindow] | null {
  const span = Math.round((civilTimestamp(window.to) - civilTimestamp(window.from)) / DAY_MS);
  if (span <= 0) return null;
  const leftTo = addCivilDays(window.from, Math.floor(span / 2));
  return [
    { from: window.from, to: leftTo },
    { from: addCivilDays(leftTo, 1), to: window.to },
  ];
}

export function isReleaseWindowIncomplete(response: ReleasesResponse): boolean {
  return response.meta.count >= response.meta.limit || response.meta.sourceTruncated;
}

export function mergeReleaseResponses(
  current: ReleasesResponse | null,
  next: ReleasesResponse,
): ReleasesResponse {
  const generatedAt = current?.meta.generatedAt ?? next.meta.generatedAt;
  const from = current?.meta.from ?? next.meta.from;
  const items = new Map<string, ReleasesResponse['data'][number]>();

  for (const item of [...(current?.data ?? []), ...next.data]) {
    const key = `${String(item.id)}:${item.releaseDate}`;
    if (!items.has(key)) items.set(key, item);
  }

  const data = [...items.values()].sort(
    (left, right) =>
      left.releaseDate.localeCompare(right.releaseDate) ||
      left.name.localeCompare(right.name, 'pt-BR') ||
      left.id - right.id,
  );

  return {
    data,
    meta: {
      from,
      to:
        next.meta.to > (current?.meta.to ?? '') ? next.meta.to : (current?.meta.to ?? next.meta.to),
      count: data.length,
      limit: PAGE_LIMIT,
      generatedAt,
      sourceTruncated: false,
    },
  };
}
