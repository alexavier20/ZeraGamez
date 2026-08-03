import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { Header } from '@/shared/components/header/Header';

const user = { name: 'Alex', initials: 'AB' } as const;

describe('Header', () => {
  it('renderiza composições responsivas sem observar o viewport em JavaScript', () => {
    const onTabletMenuClick = vi.fn();
    render(
      <MemoryRouter>
        <Header onTabletMenuClick={onTabletMenuClick} user={user} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('header-desktop')).toHaveClass('lg:flex');
    expect(screen.getByTestId('header-tablet')).toHaveClass('sm:flex', 'lg:hidden');
    expect(screen.getByTestId('header-mobile')).toHaveClass('sm:hidden');
    expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Abrir menu' }));
    expect(onTabletMenuClick).toHaveBeenCalledOnce();
  });

  it('encaminha a variante contextual para o cabeçalho mobile', () => {
    const onBack = vi.fn();
    render(
      <MemoryRouter>
        <Header onBack={onBack} title="Detalhes do jogo" user={user} variant="detail" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Detalhes do jogo')).toBeInTheDocument();
  });
});
