import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { GlobalSearch } from '@/shared/components/header/GlobalSearch';
import { HeaderActions } from '@/shared/components/header/HeaderActions';

describe('Header controls', () => {
  it('mantém um indicador de foco visível para o campo de busca', () => {
    const { unmount } = render(<GlobalSearch />);

    try {
      expect(screen.getByRole('search')).toHaveClass('focus-within:outline-2');
    } finally {
      unmount();
    }
  });

  it('normaliza a busca e ignora consultas vazias', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<GlobalSearch onSearch={onSearch} />);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar jogos' }), '   ');
    await user.click(screen.getByRole('button', { name: 'Executar busca' }));
    expect(onSearch).not.toHaveBeenCalled();

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar jogos' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar jogos' }), '  Hollow Knight  ');
    await user.click(screen.getByRole('button', { name: 'Executar busca' }));
    expect(onSearch).toHaveBeenCalledWith('Hollow Knight');
  });

  it('mostra um link visível para entrar para visitantes anônimos', () => {
    render(
      <MemoryRouter>
        <HeaderActions account={{ status: 'anonymous' }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(screen.queryByRole('button', { name: 'Abrir notificações' })).not.toBeInTheDocument();
  });

  it('exibe o perfil autenticado sem notificações e mantém a saudação ao lado do avatar', async () => {
    const user = userEvent.setup();
    const onProfileClick = vi.fn();
    render(
      <MemoryRouter>
        <HeaderActions
          account={{ status: 'authenticated', user: { name: 'Alex', initials: 'AB' } }}
          onProfileClick={onProfileClick}
        />
      </MemoryRouter>,
    );

    const profileLink = screen.getByRole('link', { name: 'Abrir perfil de Alex' });
    await user.click(profileLink);

    expect(screen.queryByRole('button', { name: /notificações/i })).not.toBeInTheDocument();
    expect(screen.getByText('Olá, Alex')).toBeInTheDocument();
    expect(onProfileClick).toHaveBeenCalledOnce();
    expect(profileLink).toHaveAttribute('href', '/perfil');
  });
});
