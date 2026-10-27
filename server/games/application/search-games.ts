import type { GameSearchResult } from '../../../shared/contracts/game-search';

export interface GameSearchRepository {
  search(query: string): Promise<readonly GameSearchResult[]>;
  listMostAnticipated(): Promise<readonly GameSearchResult[]>;
  listTopHyped(): Promise<readonly GameSearchResult[]>;
}

export function searchGames(query: string, repository: GameSearchRepository) {
  return repository.search(query);
}

export function listMostAnticipatedGames(repository: GameSearchRepository) {
  return repository.listMostAnticipated();
}

export function listTopHypedGames(repository: GameSearchRepository) {
  return repository.listTopHyped();
}
