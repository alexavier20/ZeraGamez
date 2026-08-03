import { Menu } from 'lucide-react';

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
    <MobileContextHeader onNotificationsClick={props.onNotificationsClick} variant="default" />
  );
}

export function Header(props: HeaderProps) {
  return (
    <header className="border-b border-header-border bg-brand text-text-primary">
      <div className="mx-auto max-w-[1440px]">
        <div
          className="hidden h-[72px] items-center gap-6 px-6 lg:flex"
          data-testid="header-desktop"
        >
          <HeaderBrand />
          <DesktopNavigation />
          <GlobalSearch className="min-w-48 flex-1" onSearch={props.onSearch} />
          <HeaderActions
            onNotificationsClick={props.onNotificationsClick}
            onProfileClick={props.onProfileClick}
            user={props.user}
          />
        </div>

        <div
          className="hidden h-16 items-center gap-4 px-5 sm:flex lg:hidden"
          data-testid="header-tablet"
        >
          <HeaderBrand compact />
          <GlobalSearch className="flex-1" onSearch={props.onSearch} />
          <button
            aria-label={headerCopy.tabletMenuLabel}
            className="grid size-10 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
            onClick={props.onTabletMenuClick}
            type="button"
          >
            <Menu aria-hidden="true" size={22} />
          </button>
        </div>

        <div className="sm:hidden" data-testid="header-mobile">
          {renderMobileHeader(props)}
        </div>
      </div>
    </header>
  );
}
