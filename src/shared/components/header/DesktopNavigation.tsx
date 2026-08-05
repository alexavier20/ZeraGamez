import { NavLink } from 'react-router';

import { desktopNavItems, headerCopy, headerRoutes } from './header.config';

export function DesktopNavigation() {
  return (
    <nav aria-label={headerCopy.desktopNavigationLabel} className="flex items-center gap-[22px]">
      {desktopNavItems.map((item) => (
        <NavLink
          className={({ isActive }) =>
            `rounded-md px-1 py-2 text-sm text-header-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-primary ${
              isActive ? 'font-semibold text-text-primary' : 'hover:text-text-primary'
            }`
          }
          end={item.to === headerRoutes.home}
          key={item.to}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
