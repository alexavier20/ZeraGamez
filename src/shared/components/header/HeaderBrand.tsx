import { Link } from 'react-router';

import { headerCopy, headerRoutes } from './header.config';

interface HeaderBrandProps {
  readonly compact?: boolean;
  readonly tone?: 'light' | 'brand';
}

export function HeaderBrand({ compact = false, tone = 'light' }: Readonly<HeaderBrandProps>) {
  const focusClass =
    tone === 'brand' ? 'focus-visible:outline-brand-bright' : 'focus-visible:outline-white';
  const [firstWord, ...remainingWords] = headerCopy.brand.split(' ');
  const secondWord = remainingWords.join(' ');

  return (
    <Link
      aria-label={headerCopy.brand}
      className={`flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 ${focusClass} lg:mr-3`}
      to={headerRoutes.home}
    >
      <span
        aria-hidden="true"
        className={`brand-mark bg-icon ${compact ? 'size-8' : 'h-10 w-[54px]'}`}
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
      <span className="font-heading text-xl font-bold text-logo">
        <span>{firstWord}</span>
        <span>
          {' ' + secondWord.slice(0, -1)}
          <span className="lowercase">{secondWord.slice(-1)}</span>
        </span>
      </span>
    </Link>
  );
}
