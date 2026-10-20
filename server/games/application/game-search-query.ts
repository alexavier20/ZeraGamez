const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;

export class InvalidGameSearchQueryError extends Error {}

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
