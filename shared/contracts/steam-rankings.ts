import { z } from 'zod';

export const steamRankingMetricSchema = z.enum(['peak-players', 'positive-reviews', 'top-sellers']);
export type SteamRankingMetric = z.infer<typeof steamRankingMetricSchema>;

export const steamRankingLabels: Record<SteamRankingMetric, string> = {
  'peak-players': 'Steam 24hr Peak Players',
  'positive-reviews': 'Steam Positive Reviews',
  'top-sellers': 'Steam Global Top Sellers',
};
