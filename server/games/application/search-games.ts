import type { GameSearchResult } from '../../../shared/contracts/game-search';

export interface GameSearchRepository {
  search(query: string): Promise<readonly GameSearchResult[]>;
}

export function searchGames(query: string, repository: GameSearchRepository) {
  return repository.search(query);
}
