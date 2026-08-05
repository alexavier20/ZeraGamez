export interface HeaderUser {
  readonly name: string;
  readonly initials: string;
}

interface IconHeaderContextAction {
  readonly kind: 'share' | 'menu';
  readonly label: string;
  readonly onClick: () => void;
}

interface TextHeaderContextAction {
  readonly kind: 'text';
  readonly label: string;
  readonly text: string;
  readonly onClick: () => void;
}

export type HeaderContextAction = Readonly<IconHeaderContextAction | TextHeaderContextAction>;

interface HeaderBaseProps {
  readonly user: HeaderUser;
  readonly onSearch?: (query: string) => void;
  readonly onNotificationsClick?: () => void;
  readonly onProfileClick?: () => void;
  readonly onTabletMenuClick?: () => void;
}

interface DefaultHeaderProps extends HeaderBaseProps {
  readonly variant?: 'default';
  readonly title?: never;
  readonly onBack?: never;
  readonly onClose?: never;
  readonly contextAction?: never;
}

interface DetailHeaderProps extends HeaderBaseProps {
  readonly variant: 'detail';
  readonly title: string;
  readonly onBack: () => void;
  readonly onClose?: never;
  readonly contextAction?: HeaderContextAction;
}

interface FormHeaderProps extends HeaderBaseProps {
  readonly variant: 'form';
  readonly title: string;
  readonly onBack?: never;
  readonly onClose: () => void;
  readonly contextAction: HeaderContextAction;
}

export type HeaderProps = Readonly<DefaultHeaderProps | DetailHeaderProps | FormHeaderProps>;

export interface NavigationItem {
  readonly label: string;
  readonly to: string;
}

export interface MobileNavigationItem extends NavigationItem {
  readonly icon: 'home' | 'explore' | 'lists' | 'profile';
}
