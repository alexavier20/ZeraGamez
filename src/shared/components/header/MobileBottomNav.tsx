import { Compass, House, Library, User, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

import { headerCopy, headerRoutes, mobileNavItems } from './header.config';
import type { MobileNavigationItem } from './header.types';

const mobileIcons: Readonly<Record<MobileNavigationItem['icon'], LucideIcon>> = {
  home: House,
  explore: Compass,
  lists: Library,
  profile: User,
};

interface MobileBottomNavProps {
  readonly onProfileClick?: () => void;
}

export function MobileBottomNav({ onProfileClick }: Readonly<MobileBottomNavProps>) {
  return (
    <nav
      aria-label={headerCopy.mobileNavigationLabel}
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 grid h-[68px] grid-cols-4 rounded-2xl border border-header-border bg-bg-secondary/95 px-2 shadow-2xl backdrop-blur sm:hidden"
      data-testid="mobile-bottom-nav"
    >
      {mobileNavItems.map((item) => {
        const Icon = mobileIcons[item.icon];
        return (
          <NavLink
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${
                isActive ? 'text-brand-bright' : 'text-text-muted hover:text-text-primary'
              }`
            }
            end={item.to === headerRoutes.home}
            key={item.to}
            onClick={item.icon === 'profile' ? onProfileClick : undefined}
            to={item.to}
          >
            <Icon aria-hidden="true" size={20} />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
