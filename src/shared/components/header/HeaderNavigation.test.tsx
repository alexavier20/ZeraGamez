import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { DesktopNavigation } from '@/shared/components/header/DesktopNavigation';
import { HeaderBrand } from '@/shared/components/header/HeaderBrand';

describe('Header navigation', () => {
  it('leva a marca para o início', () => {
    render(
      <MemoryRouter>
        <HeaderBrand />
      </MemoryRouter>,
    );

    const brandLink = screen.getByRole('link', { name: 'Zera GameZ' });
    expect(brandLink).toHaveAttribute('href', '/');
    expect(brandLink.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/images/zera-gamez-z-icon-white-header.png',
    );
  });

  it('marca a rota principal ativa', () => {
    render(
      <MemoryRouter initialEntries={['/lancamentos']}>
        <DesktopNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Lançamentos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Minhas listas' })).toHaveAttribute(
      'href',
      '/minhas-listas',
    );
  });
});
