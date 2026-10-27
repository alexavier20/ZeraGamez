import type { MobileNavigationItem, NavigationItem } from './header.types';

export const headerRoutes = {
  home: '/',
  releases: '/lancamentos',
  lists: '/minhas-listas',
  hype: '/to-no-hype',
  createList: '/minhas-listas/nova',
  profile: '/perfil',
} as const;

export const headerCopy = {
  brand: 'Zera GameZ',
  searchLabel: 'Buscar jogos',
  searchPlaceholder: 'Buscar jogos...',
  searchButtonLabel: 'Executar busca',
  tabletMenuLabel: 'Abrir menu',
  mobileNavigationLabel: 'Navegação móvel',
  desktopNavigationLabel: 'Navegação principal',
} as const;

export const desktopNavItems: readonly NavigationItem[] = [
  { label: 'Início', to: headerRoutes.home },
  { label: 'Lançamentos', to: headerRoutes.releases },
  { label: 'Minhas listas', to: headerRoutes.lists },
  { label: 'Tô no Hype', to: headerRoutes.hype },
];

export const mobileNavItems: readonly MobileNavigationItem[] = [
  { label: 'Início', to: headerRoutes.home, icon: 'home' },
  { label: 'Explorar', to: headerRoutes.releases, icon: 'explore' },
  { label: 'Listas', to: headerRoutes.lists, icon: 'lists' },
  { label: 'Perfil', to: headerRoutes.profile, icon: 'profile' },
];
