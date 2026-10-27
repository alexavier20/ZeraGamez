import type { GameSearchResult } from '../../../../shared/contracts/game-search';

export const tierLabels = ['S', 'A', 'B', 'C', 'D'] as const;

export type TierLabel = (typeof tierLabels)[number];

export interface TierListSummary {
  readonly description: string | null;
  readonly gameCount: number;
  readonly id: number;
  readonly name: string;
}

export interface TierListItem {
  readonly coverUrl: string | null;
  readonly igdbId: number;
  readonly name: string;
  readonly position: number;
  readonly releaseDate: string | null;
  readonly tier: TierLabel | null;
}

export interface TierListDetails extends TierListSummary {
  readonly items: readonly TierListItem[];
}

export type TierListGame = GameSearchResult;
