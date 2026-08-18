export interface AddToListsOption {
  readonly id: string;
  readonly name: string;
  readonly covers: readonly string[];
}

const coverPath = '/assets/images/game-covers/';

export const demoAddToListsOptions = [
  {
    id: 'want-to-play',
    name: 'Quero jogar',
    covers: [
      `${coverPath}eclipse-protocol.png`,
      `${coverPath}neon-vale.png`,
      `${coverPath}iron-horizon.png`,
    ],
  },
  {
    id: 'completed',
    name: 'Já zerei',
    covers: [
      `${coverPath}circuit-breakers.png`,
      `${coverPath}astra-divide.png`,
      `${coverPath}mythweaver.png`,
    ],
  },
  {
    id: 'liked',
    name: 'Jogos que gostei',
    covers: [
      `${coverPath}mythweaver.png`,
      `${coverPath}echoes-of-tides.png`,
      `${coverPath}circuit-breakers.png`,
    ],
  },
  {
    id: 'waiting',
    name: 'Aguardando lançamento',
    covers: [
      `${coverPath}hollow-signal.png`,
      `${coverPath}astra-divide.png`,
      `${coverPath}iron-horizon.png`,
    ],
  },
  {
    id: 'favorites',
    name: 'Favoritos',
    covers: [
      `${coverPath}mythweaver.png`,
      `${coverPath}eclipse-protocol.png`,
      `${coverPath}echoes-of-tides.png`,
    ],
  },
  {
    id: 'friends-coop',
    name: 'Co-op com amigos',
    covers: [
      `${coverPath}circuit-breakers.png`,
      `${coverPath}iron-horizon.png`,
      `${coverPath}neon-vale.png`,
    ],
  },
  {
    id: 'discover-indies',
    name: 'Indies para conhecer',
    covers: [
      `${coverPath}hollow-signal.png`,
      `${coverPath}echoes-of-tides.png`,
      `${coverPath}mythweaver.png`,
    ],
  },
  {
    id: 'rpg-marathon',
    name: 'RPGs para maratonar',
    covers: [
      `${coverPath}astra-divide.png`,
      `${coverPath}eclipse-protocol.png`,
      `${coverPath}mythweaver.png`,
    ],
  },
] as const satisfies readonly AddToListsOption[];
