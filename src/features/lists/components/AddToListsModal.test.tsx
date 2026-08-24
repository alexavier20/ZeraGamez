import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AddToListsModal } from '@/features/lists/components/AddToListsModal';

import type { ListsState } from '@/features/lists/context/ListsProvider';
import type { UserListSummary } from '@/features/lists/model/lists';

const lists: readonly UserListSummary[] = [
  {
    id: 7,
    name: 'RPGs',
    covers: ['/cover-a.png', '/cover-b.png', '/cover-c.png'],
    description: 'Campanhas longas',
    gameCount: 2,
    systemKey: null,
  },
  {
    id: 9,
    name: 'Quero jogar',
    covers: ['/cover-d.png', '/cover-e.png', '/cover-f.png'],
    description: null,
    gameCount: 1,
    systemKey: 'want_to_play',
  },
  {
    id: 11,
    name: 'Jogos que gostei',
    covers: ['/cover-g.png', '/cover-h.png', '/cover-i.png'],
    description: null,
    gameCount: 3,
    systemKey: null,
  },
  {
    id: 13,
    name: 'Aguardando lançamento',
    covers: ['/cover-j.png', '/cover-k.png', '/cover-l.png'],
    description: null,
    gameCount: 4,
    systemKey: null,
  },
  {
    id: 15,
    name: 'Favoritos',
    covers: ['/cover-m.png', '/cover-n.png', '/cover-o.png'],
    description: null,
    gameCount: 5,
    systemKey: null,
  },
];

const successState: ListsState = { status: 'success', lists };

function renderModal(overrides: Partial<React.ComponentProps<typeof AddToListsModal>> = {}) {
  const props: React.ComponentProps<typeof AddToListsModal> = {
    gameName: 'Eclipse Protocol',
    listsState: successState,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onRetry: vi.fn(),
    open: true,
    ...overrides,
  };

  return { ...render(<AddToListsModal {...props} />), props };
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe('AddToListsModal', () => {
  it('keeps selections across pages and confirms numeric list ids', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({ onClose, onConfirm });

    const dialog = screen.getByRole('dialog', { name: 'Adicionar Eclipse Protocol à lista' });
    const addButton = screen.getByRole('button', { name: 'Adicionar' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Selecione uma ou mais listas')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(addButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'RPGs' }));
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    await user.click(screen.getByRole('button', { name: 'Favoritos' }));

    expect(screen.getByText('2 listas selecionadas')).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(screen.getByRole('button', { name: 'RPGs' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(addButton);

    expect(onConfirm).toHaveBeenCalledWith([7, 15]);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it('keeps the modal open and preserves selection when persistence fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({
      onClose,
      onConfirm: vi.fn().mockRejectedValue(new Error('raw provider detail')),
    });

    await user.click(screen.getByRole('button', { name: 'RPGs' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível adicionar o jogo. Tente novamente.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('raw provider detail');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RPGs' })).toHaveAttribute('aria-pressed', 'true');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes only after confirmed persistence', async () => {
    const user = userEvent.setup();
    const pending = deferred<undefined>();
    const onClose = vi.fn();
    renderModal({ onClose, onConfirm: vi.fn(() => pending.promise) });

    await user.click(screen.getByRole('button', { name: 'RPGs' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(onClose).not.toHaveBeenCalled();
    pending.resolve(undefined);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it('blocks duplicate selection, paging, confirmation, and dismissal while submitting', async () => {
    const user = userEvent.setup();
    const pending = deferred<undefined>();
    const onClose = vi.fn();
    const onConfirm = vi.fn(() => pending.promise);
    renderModal({ onClose, onConfirm });

    await user.click(screen.getByRole('button', { name: 'RPGs' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'RPGs' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fechar modal' })).toBeDisabled();
    expect(screen.getByTestId('add-to-lists-backdrop')).toBeDisabled();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledOnce();

    pending.resolve(undefined);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it.each([{ status: 'idle' as const }, { status: 'loading' as const }])(
    'announces list loading for $status state',
    (listsState) => {
      renderModal({ listsState });

      expect(screen.getByRole('status')).toHaveTextContent('Carregando suas listas…');
      expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument();
    },
  );

  it('shows a sanitized load error and offers retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderModal({
      listsState: {
        status: 'error',
        message: 'Não foi possível carregar suas listas. Tente novamente.',
      },
      onRetry,
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar suas listas. Tente novamente.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('dismisses through Escape and focuses the close control when opened', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({
      listsState: { status: 'success', lists: lists.slice(0, 4) },
      onClose,
    });

    expect(screen.queryByText(/Página 1 de/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar modal' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('dismisses only when the backdrop itself is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

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
          listsState={{ status: 'success', lists: [] }}
          onClose={vi.fn()}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
          onRetry={vi.fn()}
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
    renderModal({ open: false });

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
            listsState={successState}
            onClose={() => {
              setOpen(false);
            }}
            onConfirm={vi.fn().mockResolvedValue(undefined)}
            onRetry={vi.fn()}
            open={open}
          />
        </>
      );
    }

    render(<ControlledModal />);

    await user.click(screen.getByRole('button', { name: 'RPGs' }));
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Abrir novamente' }));

    expect(screen.getByText('Selecione uma ou mais listas')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'RPGs' })).toHaveAttribute('aria-pressed', 'false');
  });
});
