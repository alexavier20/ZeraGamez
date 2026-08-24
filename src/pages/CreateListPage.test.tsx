import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { ListsProvider } from '@/features/lists/context/ListsProvider';

import { CreateListPage } from './CreateListPage';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import type { ListsRepository } from '@/features/lists/api/lists-repository';
import type { UserListSummary } from '@/features/lists/model/lists';

const authenticatedUser: AuthenticatedUser = {
  avatarUrl: null,
  email: 'alex@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  initials: 'AX',
  name: 'Alex Xavier',
};

const rpgList: UserListSummary = {
  covers: [],
  description: 'Para jogar',
  gameCount: 0,
  id: 7,
  name: 'RPGs',
  systemKey: null,
};

function createAuthService(): AuthService {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(authenticatedUser),
    onAuthStateChange: vi.fn(() => vi.fn()),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function createRepository(createList: ListsRepository['createList']): ListsRepository {
  return {
    addGameToLists: vi.fn().mockResolvedValue([]),
    createList,
    getWantToPlayIds: vi.fn().mockResolvedValue(new Set<number>()),
    listSummaries: vi.fn().mockResolvedValue([rpgList]),
    toggleWantToPlay: vi.fn().mockResolvedValue(false),
  };
}

function renderCreateList(repository: ListsRepository) {
  render(
    <AuthProvider service={createAuthService()}>
      <ListsProvider repository={repository}>
        <MemoryRouter initialEntries={['/minhas-listas/nova']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route element={<CreateListPage />} path="/minhas-listas/nova" />
              <Route element={<h1>Coleção de listas</h1>} path="/minhas-listas" />
            </Route>
          </Routes>
        </MemoryRouter>
      </ListsProvider>
    </AuthProvider>,
  );
}

describe('CreateListPage', () => {
  it('creates a normalized list and returns to the collection', async () => {
    const user = userEvent.setup();
    const createList = vi.fn().mockResolvedValue(rpgList);
    renderCreateList(createRepository(createList));

    await user.type(await screen.findByRole('textbox', { name: 'Nome da lista' }), '  RPGs  ');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), '  Para jogar  ');
    await user.click(screen.getByRole('button', { name: 'Criar lista' }));

    expect(createList).toHaveBeenCalledWith(authenticatedUser.id, {
      name: 'RPGs',
      description: 'Para jogar',
    });
    expect(await screen.findByRole('heading', { name: 'Coleção de listas' })).toBeInTheDocument();
  });

  it('exposes the field limits and associates a focused name error', async () => {
    const user = userEvent.setup();
    const createList = vi.fn().mockResolvedValue(rpgList);
    renderCreateList(createRepository(createList));

    const name = await screen.findByRole('textbox', { name: 'Nome da lista' });
    const description = screen.getByRole('textbox', { name: 'Descrição' });
    expect(name).toHaveAttribute('maxlength', '80');
    expect(description).toHaveAttribute('maxlength', '500');

    await user.type(name, '   ');
    await user.click(screen.getByRole('button', { name: 'Criar lista' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe um nome para a lista.');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('aria-describedby', 'create-list-name-error');
    expect(name).toHaveFocus();
    expect(createList).not.toHaveBeenCalled();
  });

  it('announces pending creation and blocks duplicate submission', async () => {
    const user = userEvent.setup();
    const createList = vi.fn(() => new Promise<UserListSummary>(() => undefined));
    renderCreateList(createRepository(createList));

    await user.type(await screen.findByRole('textbox', { name: 'Nome da lista' }), 'RPGs');
    await user.click(screen.getByRole('button', { name: 'Criar lista' }));

    const pendingButton = screen.getByRole('button', { name: 'Criando lista…' });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Criando lista…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await user.click(pendingButton);
    expect(createList).toHaveBeenCalledOnce();
  });

  it('preserves values, stays on the form, and sanitizes submission errors', async () => {
    const user = userEvent.setup();
    const createList = vi.fn().mockRejectedValue(new Error('database constraint detail'));
    renderCreateList(createRepository(createList));

    const name = await screen.findByRole('textbox', { name: 'Nome da lista' });
    const description = screen.getByRole('textbox', { name: 'Descrição' });
    await user.type(name, ' RPGs ');
    await user.type(description, ' Para jogar ');
    await user.click(screen.getByRole('button', { name: 'Criar lista' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível criar a lista. Tente novamente.',
    );
    expect(screen.queryByText('database constraint detail')).not.toBeInTheDocument();
    expect(name).toHaveValue(' RPGs ');
    expect(description).toHaveValue(' Para jogar ');
    expect(name).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Criar lista' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar lista' })).toBeEnabled());
  });
});
