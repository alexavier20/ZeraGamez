import { Link } from 'react-router';

import { UserAvatar } from '@/features/auth/components/UserAvatar';

import { headerRoutes } from './header.config';

import type { HeaderAccount } from './header.types';

interface HeaderActionsProps {
  readonly account: HeaderAccount;
  readonly onProfileClick?: () => void;
}

export function HeaderActions({ account, onProfileClick }: Readonly<HeaderActionsProps>) {
  if (account.status === 'anonymous') {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <Link
          className="flex h-8 items-center rounded-lg border border-white/25 bg-app px-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
          to="/entrar"
        >
          Entrar
        </Link>
      </div>
    );
  }

  const { user } = account;

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <Link
        aria-label={`Abrir perfil de ${user.name}`}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={onProfileClick}
        title={user.name}
        to={headerRoutes.profile}
      >
        <UserAvatar
          avatarUrl={user.avatarUrl ?? null}
          className="size-8 border border-white text-[10px]"
          initials={user.initials}
          name={user.name}
        />
      </Link>
      <span className="hidden max-w-40 truncate text-sm font-medium text-content-primary xl:inline">
        Olá, {user.name}
      </span>
    </div>
  );
}
