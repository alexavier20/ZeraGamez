import type { MobileNavigationItem, NavigationItem } from './header.types';

export const headerRoutes = {
  home: '/',
  releases: '/lancamentos',
  lists: '/minhas-listas',
  createList: '/minhas-listas/nova',
  profile: '/perfil',
} as const;

export const headerCopy = {
  brand: 'Zera GameZ',
  searchLabel: 'Buscar jogos',
  searchPlaceholder: 'Buscar jogos...',
  searchButtonLabel: 'Executar busca',
  notificationsLabel: 'Abrir notificações',
  tabletMenuLabel: 'Abrir menu',
  createList: 'Criar lista',
  mobileNavigationLabel: 'Navegação móvel',
  desktopNavigationLabel: 'Navegação principal',
} as const;

export const desktopNavItems: readonly NavigationItem[] = [
  { label: 'Início', to: headerRoutes.home },
  { label: 'Lançamentos', to: headerRoutes.releases },
  { label: 'Minhas listas', to: headerRoutes.lists },
];

export const mobileNavItems: readonly MobileNavigationItem[] = [
  { label: 'Início', to: headerRoutes.home, icon: 'home' },
  { label: 'Explorar', to: headerRoutes.releases, icon: 'explore' },
  { label: 'Listas', to: headerRoutes.lists, icon: 'lists' },
  { label: 'Perfil', to: headerRoutes.profile, icon: 'profile' },
];
