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

  it('abre a página vazia de Lançamentos pelo Header', async () => {
    const user = userEvent.setup();
    render(<AppRouter />);

    const releasesLink = screen.getByRole('link', { name: 'Lançamentos' });
    await user.click(releasesLink);

    expect(window.location.pathname).toBe('/lancamentos');
    expect(screen.getByRole('main', { name: 'Lançamentos' })).toBeEmptyDOMElement();
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
