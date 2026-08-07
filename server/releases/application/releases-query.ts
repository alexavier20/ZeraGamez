import type { Clock } from './list-upcoming-releases';

export interface ReleaseQuery {
  from: string;
  to: string;
  limit: number;
  platformIds: number[];
  genreIds: number[];
}

export class InvalidQueryError extends Error {}

const allowedKeys = new Set(['from', 'to', 'limit', 'platforms', 'genres']);

function parseCivilDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new InvalidQueryError('Data inválida.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new InvalidQueryError('Data inválida.');
  return value;
}

function addDays(value: string, days: number) {
  const date = new Date(value + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateInSaoPaulo(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return values.year + '-' + values.month + '-' + values.day;
}

function parseIdList(value: string | null) {
  if (value === null) return [];
  if (!/^\d+(,\d+)*$/.test(value)) throw new InvalidQueryError('Lista de IDs inválida.');
  const ids = value.split(',').map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw new InvalidQueryError('Lista de IDs inválida.');
  }
  return ids;
}

export function parseReleasesQuery(params: URLSearchParams, clock: Clock): ReleaseQuery {
  for (const key of params.keys()) {
    if (!allowedKeys.has(key) || params.getAll(key).length !== 1) {
      throw new InvalidQueryError('Parâmetro inválido.');
    }
  }

  const from = parseCivilDate(params.get('from') ?? dateInSaoPaulo(clock.now()));
  const to = parseCivilDate(params.get('to') ?? addDays(from, 90));
  const difference = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000;
  if (difference < 0 || difference > 366) throw new InvalidQueryError('Período inválido.');

  const limitValue = params.get('limit') ?? '50';
  if (!/^\d+$/.test(limitValue)) throw new InvalidQueryError('Limite inválido.');
  const limit = Number(limitValue);
  if (limit < 1 || limit > 100) throw new InvalidQueryError('Limite inválido.');

  return {
    from,
    to,
    limit,
    platformIds: parseIdList(params.get('platforms')),
    genreIds: parseIdList(params.get('genres')),
  };
}

export { addDays };
