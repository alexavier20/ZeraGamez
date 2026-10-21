import { z } from 'zod';

export interface GameSnapshot {
  readonly coverUrl: string | null;
  readonly igdbId: number;
  readonly name: string;
  readonly releaseDate: string;
}

export interface CompletedGameSnapshot {
  readonly coverUrl: string | null;
  readonly igdbId: number;
  readonly name: string;
  readonly releaseDate: string | null;
}

export type ListGame = CompletedGameSnapshot;

export interface UserListSummary {
  readonly covers: readonly string[];
  readonly description: string | null;
  readonly gameCount: number;
  readonly id: number;
  readonly name: string;
  readonly systemKey: 'completed' | 'want_to_play' | null;
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
    .max(80, 'O nome deve ter no máximo 80 caracteres.')
    .refine(
      (value) => !['quero jogar!', 'já zerei'].includes(value.toLocaleLowerCase('pt-BR')),
      'Os nomes "Quero Jogar!" e "Já Zerei" são reservados para listas automáticas.',
    ),
});

export function normalizeCreateListInput(input: CreateListInput): CreateListInput {
  const parsed = createListInputSchema.parse(input);

  return Object.freeze({
    description: parsed.description,
    name: parsed.name,
  });
}
