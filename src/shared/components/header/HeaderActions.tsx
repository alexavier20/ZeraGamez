import { UserRound } from 'lucide-react';
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
          aria-label="Entrar"
          className="grid size-10 place-items-center rounded-full text-white transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          title="Entrar"
          to="/entrar"
        >
          <UserRound aria-hidden="true" size={22} strokeWidth={1.7} />
        </Link>
      </div>
    );
  }

  const { user } = account;

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <Link
        aria-label={`Abrir perfil de ${user.name}`}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={onProfileClick}
        title={user.name}
        to={headerRoutes.profile}
      >
        <UserAvatar
          avatarUrl={user.avatarUrl ?? null}
          className="size-8 border border-white/50 text-[10px]"
          initials={user.initials}
          name={user.name}
        />
      </Link>
      <span className="hidden max-w-40 truncate text-sm font-medium text-white xl:inline">
        Olá, {user.name}
      </span>
    </div>
  );
}
