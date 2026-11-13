import { NavLink } from 'react-router';

import { desktopNavItems, headerCopy, headerRoutes } from './header.config';

interface DesktopNavigationProps {
  readonly onNavigate?: () => void;
  readonly vertical?: boolean;
}

export function DesktopNavigation({ onNavigate, vertical = false }: Readonly<DesktopNavigationProps>) {
  return (
    <nav
      aria-label={headerCopy.desktopNavigationLabel}
      className={vertical ? 'flex flex-col gap-1' : 'flex min-w-max items-center gap-4'}
    >
      {desktopNavItems.map((item) => (
        <NavLink
          className={({ isActive }) =>
            `${vertical ? 'rounded-lg px-3 py-3 text-header-text focus-visible:outline-text-primary' : "relative rounded-md px-1 pt-2 pb-3 after:absolute after:inset-x-1 after:bottom-2 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-white after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 focus-visible:after:scale-x-100 focus-visible:outline-white"} whitespace-nowrap text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isActive
                ? vertical
                  ? 'bg-brand-bright/20 text-brand'
                  : 'text-white after:scale-x-100'
                : vertical
                  ? 'hover:bg-brand-bright hover:text-brand-ink'
                  : 'text-white/90 hover:text-white'
            }`
          }
          end={item.to === headerRoutes.home}
          key={item.to}
          onClick={onNavigate}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
