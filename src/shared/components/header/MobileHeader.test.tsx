import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { MobileBottomNav } from '@/shared/components/header/MobileBottomNav';
import { MobileContextHeader } from '@/shared/components/header/MobileContextHeader';

describe('Mobile Header', () => {
  it('renderiza a marca e aciona notificações na variante padrão', async () => {
    const user = userEvent.setup();
    const onNotificationsClick = vi.fn();
    render(
      <MemoryRouter>
        <MobileContextHeader onNotificationsClick={onNotificationsClick} variant="default" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Zera GameZ' })).toHaveAttribute('href', '/');
    await user.click(screen.getByRole('button', { name: 'Abrir notificações' }));
    expect(onNotificationsClick).toHaveBeenCalledOnce();
  });

  it('aciona voltar e compartilhar na variante de detalhes', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onShare = vi.fn();
    render(
      <MobileContextHeader
        contextAction={{ kind: 'share', label: 'Compartilhar jogo', onClick: onShare }}
        onBack={onBack}
        title="Detalhes do jogo"
        variant="detail"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Compartilhar jogo' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('aciona fechar e a ação textual na variante de formulário', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi.fn();
    render(
      <MobileContextHeader
        contextAction={{
          kind: 'text',
          label: 'Criar nova lista',
          onClick: onCreate,
          text: 'Criar',
        }}
        onClose={onClose}
        title="Criar nova lista"
        variant="form"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    await user.click(screen.getByRole('button', { name: 'Criar nova lista' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('marca a rota ativa na navegação inferior', () => {
    render(
      <MemoryRouter initialEntries={['/minhas-listas']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Listas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', '/lancamentos');
  });
});
