import type { GameDetails } from '../../../shared/contracts/game-details.js';

export interface GameDetailsRepository {
  findById(id: number): Promise<GameDetails | null>;
}

export function getGameDetails(id: number, repository: GameDetailsRepository) {
  return repository.findById(id);
}
