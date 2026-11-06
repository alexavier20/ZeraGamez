import { Link } from 'react-router';

import { desktopNavItems } from './header/header.config';
import { HeaderBrand } from './header/HeaderBrand';

export function HomeFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-bg-secondary pb-28 pt-8 sm:mt-20 sm:pb-8">
      <div className="site-container">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <HeaderBrand />
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              Lançamentos, avaliações e sua próxima jogatina
            </p>
          </div>
          <nav aria-label="Navegação do rodapé">
            <p className="mb-3 text-xs font-medium text-text-muted">Explore</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {desktopNavItems.map(({ label, to }) => (
                <li key={to}>
                  <Link
                    className="inline-flex min-h-11 items-center rounded text-sm text-text-muted transition-colors hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                    to={to}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs leading-relaxed text-text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Zera GameZ.</p>
          <p>Os jogos e suas marcas pertencem aos respectivos proprietários.</p>
        </div>
      </div>
    </footer>
  );
}
