import {
  steamRankingMetricSchema,
  type SteamRankingMetric,
} from '../../../shared/contracts/steam-rankings';

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;

export class InvalidGameSearchQueryError extends Error {}

export type GameSearchRequest =
  | { readonly type: 'search'; readonly query: string }
  | { readonly type: 'recent-reviewed' }
  | { readonly type: 'anticipated' }
  | { readonly type: 'top-hyped' }
  | { readonly type: 'steam-ranking'; readonly metric: SteamRankingMetric };

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 32 || codePoint === 127) return true;
  }
  return false;
}

export function parseGameSearchQuery(params: URLSearchParams): string {
  for (const key of params.keys()) {
    if (key !== 'q' || params.getAll(key).length !== 1) {
      throw new InvalidGameSearchQueryError('Parâmetro inválido.');
    }
  }

  const query = params.get('q')?.trim();
  if (
    query === undefined ||
    query.length < MIN_QUERY_LENGTH ||
    query.length > MAX_QUERY_LENGTH ||
    hasControlCharacters(query)
  ) {
    throw new InvalidGameSearchQueryError('Busca inválida.');
  }

  return query;
}

export function parseGameSearchRequest(params: URLSearchParams): GameSearchRequest {
  const keys = [...params.keys()];
  if (keys.length === 1 && keys[0] === 'mode' && params.get('mode') === 'recent-reviewed')
    return { type: 'recent-reviewed' };
  if (
    keys.length === 2 &&
    params.getAll('mode').length === 1 &&
    params.get('mode') === 'steam-ranking' &&
    params.getAll('metric').length === 1
  ) {
    const metric = steamRankingMetricSchema.safeParse(params.get('metric'));
    if (metric.success) return { type: 'steam-ranking', metric: metric.data };
    throw new InvalidGameSearchQueryError('Indicador inválido.');
  }
  if (keys.length === 1 && keys[0] === 'mode' && params.get('mode') === 'anticipated') {
    return { type: 'anticipated' };
  }
  if (keys.length === 1 && keys[0] === 'mode' && params.get('mode') === 'top-hyped') {
    return { type: 'top-hyped' };
  }
  if (keys.length === 1 && keys[0] === 'q') {
    return { type: 'search', query: parseGameSearchQuery(params) };
  }
  throw new InvalidGameSearchQueryError('Parâmetro inválido.');
}
