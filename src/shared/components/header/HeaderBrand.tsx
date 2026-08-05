import { Link } from 'react-router';

import { headerCopy, headerRoutes } from './header.config';

interface HeaderBrandProps {
  readonly compact?: boolean;
}

export function HeaderBrand({ compact = false }: Readonly<HeaderBrandProps>) {
  return (
    <Link
      className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-primary"
      to={headerRoutes.home}
    >
      <img
        alt=""
        className={compact ? 'size-8 object-contain' : 'h-10 w-[54px] object-contain'}
        height={compact ? 32 : 40}
        src="/assets/images/zera-gamez-z-icon-white-header.png"
        width={compact ? 32 : 54}
      />
      <span className="font-heading text-lg font-bold text-text-primary">{headerCopy.brand}</span>
    </Link>
  );
}
