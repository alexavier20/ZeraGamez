import { Menu, X } from 'lucide-react';
import { useState } from 'react';

import { DesktopNavigation } from './DesktopNavigation';
import { GlobalSearch } from './GlobalSearch';
import { headerCopy } from './header.config';
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
      variant="default"
    />
  );
}

export function Header(props: HeaderProps) {
  const [isCompactMenuOpen, setIsCompactMenuOpen] = useState(false);

  return (
    <header className="bg-brand text-white">
      <div className="site-container relative">
        <div className="hidden h-[72px] items-center gap-3 sm:flex">
          <button
            aria-controls="header-compact-navigation"
            aria-expanded={isCompactMenuOpen}
            aria-label={isCompactMenuOpen ? 'Fechar menu' : headerCopy.tabletMenuLabel}
            className="grid size-10 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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

          <div
            className="hidden min-w-0 flex-1 items-center gap-4 2xl:flex"
            data-testid="header-desktop"
          >
            <HeaderBrand />
            <GlobalSearch className="min-w-0 flex-1" onSearch={props.onSearch} />
            <HeaderActions
              account={props.account}
              onProfileClick={props.onProfileClick}
            />
          </div>

          <div
            className="hidden min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:grid 2xl:hidden"
            data-testid="header-tablet"
          >
            <HeaderBrand />
            <GlobalSearch className="w-full" onSearch={props.onSearch} />
            <HeaderActions
              account={props.account}
              onProfileClick={props.onProfileClick}
            />
          </div>
        </div>

        <div className="hidden py-0.5 sm:block">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <DesktopNavigation />
          </div>
        </div>

        {isCompactMenuOpen ? (
          <div
            className="absolute inset-x-0 top-full z-50 border-t border-border bg-bg-secondary px-3 py-2 shadow-xl"
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
