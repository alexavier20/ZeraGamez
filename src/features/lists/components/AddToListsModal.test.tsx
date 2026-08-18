import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  AddToListsModal,
  type AddToListsOption,
} from '@/features/lists/components/AddToListsModal';

const lists: readonly AddToListsOption[] = [
  {
    id: 'want-to-play',
    name: 'Quero jogar',
    covers: ['/cover-a.png', '/cover-b.png', '/cover-c.png'],
  },
  {
    id: 'completed',
    name: 'Já zerei',
    covers: ['/cover-d.png', '/cover-e.png', '/cover-f.png'],
  },
  {
    id: 'liked',
    name: 'Jogos que gostei',
    covers: ['/cover-g.png', '/cover-h.png', '/cover-i.png'],
  },
  {
    id: 'waiting',
    name: 'Aguardando lançamento',
    covers: ['/cover-j.png', '/cover-k.png', '/cover-l.png'],
  },
  {
    id: 'favorites',
    name: 'Favoritos',
    covers: ['/cover-m.png', '/cover-n.png', '/cover-o.png'],
  },
];

describe('AddToListsModal', () => {
  it('keeps selections across pages and confirms the selected list ids', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AddToListsModal
        gameName="Eclipse Protocol"
        lists={lists}
        onClose={onClose}
        onConfirm={onConfirm}
        open
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Adicionar Eclipse Protocol à lista' });
    const addButton = screen.getByRole('button', { name: 'Adicionar' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Selecione uma ou mais listas')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(addButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Quero jogar' }));
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    await user.click(screen.getByRole('button', { name: 'Favoritos' }));

    expect(screen.getByText('2 listas selecionadas')).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(screen.getByRole('button', { name: 'Quero jogar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(addButton);

    expect(onConfirm).toHaveBeenCalledWith(['want-to-play', 'favorites']);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('dismisses through Escape and focuses the close control when opened', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AddToListsModal
        gameName="Eclipse Protocol"
        lists={lists.slice(0, 4)}
        onClose={onClose}
        onConfirm={vi.fn()}
        open
      />,
    );

    expect(screen.queryByText(/Página 1 de/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar modal' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('dismisses only when the backdrop itself is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AddToListsModal
        gameName="Eclipse Protocol"
        lists={lists}
        onClose={onClose}
        onConfirm={vi.fn()}
        open
      />,
    );

    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('add-to-lists-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers list creation instead of selection controls when no lists exist', () => {
    render(
      <MemoryRouter>
        <AddToListsModal
          gameName="Eclipse Protocol"
          lists={[]}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          open
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sua biblioteca começa aqui')).toBeInTheDocument();
    expect(
      screen.getByText('Crie uma lista para organizar os jogos que você quer acompanhar.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Adicionar nova lista' })).toHaveAttribute(
      'href',
      '/minhas-listas/nova',
    );
    expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument();
  });

  it('leaves the accessibility tree when closed', () => {
    render(
      <AddToListsModal
        gameName="Eclipse Protocol"
        lists={lists}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        open={false}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts a fresh selection session when a controlled instance reopens', async () => {
    const user = userEvent.setup();

    function ControlledModal() {
      const [open, setOpen] = useState(true);

      return (
        <>
          <button
            onClick={() => {
              setOpen(true);
            }}
            type="button"
          >
            Abrir novamente
          </button>
          <AddToListsModal
            gameName="Eclipse Protocol"
            lists={lists}
            onClose={() => {
              setOpen(false);
            }}
            onConfirm={vi.fn()}
            open={open}
          />
        </>
      );
    }

    render(<ControlledModal />);

    await user.click(screen.getByRole('button', { name: 'Quero jogar' }));
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Abrir novamente' }));

    expect(screen.getByText('Selecione uma ou mais listas')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quero jogar' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
