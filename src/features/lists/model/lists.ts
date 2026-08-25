import { z } from 'zod';

export interface GameSnapshot {
  readonly coverUrl: string | null;
  readonly igdbId: number;
  readonly name: string;
  readonly releaseDate: string;
}

export interface UserListSummary {
  readonly covers: readonly string[];
  readonly description: string | null;
  readonly gameCount: number;
  readonly id: number;
  readonly name: string;
  readonly systemKey: 'want_to_play' | null;
}

export interface CreateListInput {
  readonly description: string;
  readonly name: string;
}

const createListInputSchema = z.object({
  description: z.string().trim().max(500, 'A descrição deve ter no máximo 500 caracteres.'),
  name: z
    .string()
    .trim()
    .min(1, 'Informe um nome para a lista.')
    .max(80, 'O nome deve ter no máximo 80 caracteres.'),
});

export function normalizeCreateListInput(input: CreateListInput): CreateListInput {
  const parsed = createListInputSchema.parse(input);

  return Object.freeze({
    description: parsed.description,
    name: parsed.name,
  });
}
