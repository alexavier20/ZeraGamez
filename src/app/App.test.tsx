import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppRouter } from '@/app/router';

function expectShellOrder() {
  const header = screen.getByRole('banner');
  const main = screen.getByRole('main');
  const mobileNavigation = screen.getByRole('navigation', { name: 'Navegação móvel' });

  expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(main.compareDocumentPosition(mobileNavigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe('Zera GameZ', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renderiza a página inicial', () => {
    render(<AppRouter />);

    expect(screen.getByRole('heading', { level: 1, name: 'Zera GameZ' })).toBeInTheDocument();
    expect(screen.getByText('Em construção')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { hidden: true, name: 'Navegação principal' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument();
    expectShellOrder();
  });

  it('abre Lançamentos com o título responsivo selecionado no Pencil', async () => {
    const user = userEvent.setup();
    render(<AppRouter />);

    const releasesLink = screen.getByRole('link', { name: 'Lançamentos' });
    await user.click(releasesLink);

    const main = screen.getByRole('main', { name: 'Lançamentos' });

    expect(window.location.pathname).toBe('/lancamentos');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Próximos lançamentos' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Descubra os games que estão chegando')).toBeInTheDocument();
    expect(main).toHaveClass(
      'mx-auto',
      'max-w-[1440px]',
      'px-4',
      'pt-[22px]',
      'sm:px-5',
      'sm:pt-7',
      'lg:px-8',
      'lg:pt-9',
    );
    expect(releasesLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeInTheDocument();
    expect(screen.queryByText('Em construção')).not.toBeInTheDocument();
    expectShellOrder();
  });

  it('redireciona rotas desconhecidas para o início', async () => {
    window.history.replaceState({}, '', '/rota-inexistente');
    render(<AppRouter />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Zera GameZ' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
