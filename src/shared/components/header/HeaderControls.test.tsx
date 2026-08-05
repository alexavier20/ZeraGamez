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

  it('expõe as ações do usuário e a rota para criar lista', async () => {
    const user = userEvent.setup();
    const onNotificationsClick = vi.fn();
    const onProfileClick = vi.fn();
    render(
      <MemoryRouter>
        <HeaderActions
          onNotificationsClick={onNotificationsClick}
          onProfileClick={onProfileClick}
          user={{ name: 'Alex', initials: 'AB' }}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir notificações' }));
    await user.click(screen.getByRole('button', { name: 'Abrir perfil de Alex' }));

    expect(onNotificationsClick).toHaveBeenCalledOnce();
    expect(onProfileClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Criar lista' })).toHaveAttribute(
      'href',
      '/minhas-listas/nova',
    );
  });
});
