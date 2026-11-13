import { Link } from 'react-router';

import { headerCopy, headerRoutes } from './header.config';

interface HeaderBrandProps {
  readonly compact?: boolean;
}

export function HeaderBrand({ compact = false }: Readonly<HeaderBrandProps>) {
  return (
    <Link
      className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:mr-3"
      to={headerRoutes.home}
    >
      <span
        aria-hidden="true"
        className={`brand-mark bg-white ${compact ? 'size-8' : 'h-10 w-[54px]'}`}
        style={{
          maskImage: "url('/assets/images/zera-gamez-z-icon-white-header.png')",
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
          maskSize: 'contain',
          WebkitMaskImage: "url('/assets/images/zera-gamez-z-icon-white-header.png')",
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
        }}
      />
      <span className="font-heading text-xl font-bold text-white">{headerCopy.brand}</span>
    </Link>
  );
}
