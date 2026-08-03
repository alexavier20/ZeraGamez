import { Bell, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { headerCopy, headerRoutes } from './header.config';

import type { HeaderUser } from './header.types';

interface HeaderActionsProps {
  readonly user: HeaderUser;
  readonly onNotificationsClick?: () => void;
  readonly onProfileClick?: () => void;
}

export function HeaderActions({
  user,
  onNotificationsClick,
  onProfileClick,
}: Readonly<HeaderActionsProps>) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        aria-label={headerCopy.notificationsLabel}
        className="grid size-10 place-items-center rounded-xl border border-header-border bg-header-overlay text-text-primary transition-colors hover:bg-header-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={onNotificationsClick}
        type="button"
      >
        <Bell aria-hidden="true" size={19} />
      </button>
      <button
        aria-label={`Abrir perfil de ${user.name}`}
        className="grid size-10 place-items-center rounded-full border border-white/25 bg-linear-to-br from-avatar-start to-avatar-end text-xs font-bold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={onProfileClick}
        title={user.name}
        type="button"
      >
        {user.initials}
      </button>
      <Link
        className="flex h-10 items-center gap-2 rounded-xl border border-white/25 bg-app px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        to={headerRoutes.createList}
      >
        <Plus aria-hidden="true" size={17} />
        {headerCopy.createList}
      </Link>
    </div>
  );
}
