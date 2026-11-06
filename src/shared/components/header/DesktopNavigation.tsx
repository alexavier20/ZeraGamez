import { NavLink } from 'react-router';

import { desktopNavItems, headerCopy, headerRoutes } from './header.config';

export function DesktopNavigation() {
  return (
    <nav aria-label={headerCopy.desktopNavigationLabel} className="flex items-center gap-4">
      {desktopNavItems.map((item) => (
        <NavLink
          className={({ isActive }) =>
            `relative rounded-md px-1 py-2 text-sm font-medium text-header-text transition-colors after:absolute after:inset-x-1 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-white after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 focus-visible:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-primary ${
              isActive ? 'text-text-primary after:scale-x-100' : 'hover:text-white/80'
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
