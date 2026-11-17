import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router';

import { DesktopNavigation } from './DesktopNavigation';
import { headerCopy, headerRoutes } from './header.config';
import { HeaderActions } from './HeaderActions';
import { HeaderBrand } from './HeaderBrand';
import { MobileContextHeader } from './MobileContextHeader';

import type { HeaderProps } from './header.types';

function renderMobileHeader(props: HeaderProps) {
  if (props.variant === 'detail') {
    return (
      <MobileContextHeader
        contextAction={props.contextAction}
        onBack={props.onBack}
        title={props.title}
        variant="detail"
      />
    );
  }

  if (props.variant === 'form') {
    return (
      <MobileContextHeader
        contextAction={props.contextAction}
        onClose={props.onClose}
        title={props.title}
        variant="form"
      />
    );
  }

  return (
    <MobileContextHeader
      account={props.account}
      onProfileClick={props.onProfileClick}
      onSignOut={props.onSignOut}
      variant="default"
    />
  );
}

export function Header(props: HeaderProps) {
  const [isCompactMenuOpen, setIsCompactMenuOpen] = useState(false);
  const isHomePage = useLocation().pathname === headerRoutes.home;

  return (
    <header
      className={`${isHomePage ? '' : 'mb-6'} border-b border-white/10 bg-app text-text-primary`}
    >
      <div className="site-container relative">
        <div className="hidden h-16 items-center gap-3 sm:flex">
          <div
            className="hidden min-w-0 flex-1 items-center gap-4 lg:flex 2xl:flex"
            data-testid="header-desktop"
          >
            <HeaderBrand />
            <DesktopNavigation />
            <HeaderActions
              account={props.account}
              onProfileClick={props.onProfileClick}
              onSignOut={props.onSignOut}
            />
          </div>

          <div
            className="hidden min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:grid lg:hidden 2xl:hidden"
            data-testid="header-tablet"
          >
            <HeaderBrand />
            <button
              aria-controls="header-compact-navigation"
              aria-expanded={isCompactMenuOpen}
              aria-label={isCompactMenuOpen ? 'Fechar menu' : headerCopy.tabletMenuLabel}
              className="grid size-11 place-items-center rounded-lg text-text-primary transition-colors hover:bg-brand-bright/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
              onClick={() => {
                setIsCompactMenuOpen((isOpen) => !isOpen);
                props.onTabletMenuClick?.();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsCompactMenuOpen(false);
              }}
              type="button"
            >
              {isCompactMenuOpen ? (
                <X aria-hidden="true" size={22} />
              ) : (
                <Menu aria-hidden="true" size={22} />
              )}
            </button>
            <HeaderActions
              account={props.account}
              onProfileClick={props.onProfileClick}
              onSignOut={props.onSignOut}
            />
          </div>
        </div>

        {isCompactMenuOpen ? (
          <div
            className="absolute inset-x-0 top-full z-50 border-t border-border bg-app px-3 py-2 shadow-xl lg:hidden"
            data-testid="header-compact-navigation"
            id="header-compact-navigation"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsCompactMenuOpen(false);
            }}
          >
            <DesktopNavigation onNavigate={() => setIsCompactMenuOpen(false)} vertical />
          </div>
        ) : null}

        <div className="sm:hidden" data-testid="header-mobile">
          {renderMobileHeader(props)}
        </div>
      </div>
    </header>
  );
}
