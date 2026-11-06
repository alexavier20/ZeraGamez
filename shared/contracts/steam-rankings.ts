import { z } from 'zod';

export const steamRankingMetricSchema = z.enum(['peak-players', 'positive-reviews', 'top-sellers']);
export type SteamRankingMetric = z.infer<typeof steamRankingMetricSchema>;

export const steamRankingLabels: Record<SteamRankingMetric, string> = {
  'peak-players': 'Pico de jogadores',
  'positive-reviews': 'Avaliações positivas',
  'top-sellers': 'Mais vendidos',
};
