import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { ListsProvider } from '@/features/lists/context/ListsProvider';

import { MyListsPage } from './MyListsPage';

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
  covers: ['https://images.example/one.jpg', 'https://images.example/two.jpg'],
  description: 'Campanhas longas',
  gameCount: 2,
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

function createRepository(listSummaries: ListsRepository['listSummaries']): ListsRepository {
  return {
    addGameToLists: vi.fn().mockResolvedValue([]),
    createList: vi.fn().mockResolvedValue(rpgList),
    getWantToPlayIds: vi.fn().mockResolvedValue(new Set<number>()),
    listSummaries,
    toggleWantToPlay: vi.fn().mockResolvedValue(false),
  };
}

function renderMyLists(repository: ListsRepository) {
  render(
    <AuthProvider service={createAuthService()}>
      <ListsProvider repository={repository}>
        <MemoryRouter initialEntries={['/minhas-listas']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route element={<MyListsPage />} path="/minhas-listas" />
            </Route>
          </Routes>
        </MemoryRouter>
      </ListsProvider>
    </AuthProvider>,
  );
}

describe('MyListsPage', () => {
  it('shows list summaries and links to creation', async () => {
    renderMyLists(createRepository(vi.fn().mockResolvedValue([rpgList])));

    expect(await screen.findByRole('heading', { name: 'Minhas listas' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'RPGs' })).toBeInTheDocument();
    expect(screen.getByText('2 jogos')).toBeInTheDocument();
    expect(screen.getByText('Campanhas longas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar lista' })).toHaveAttribute(
      'href',
      '/minhas-listas/nova',
    );
  });

  it('shows a named loading skeleton while summaries are pending', async () => {
    renderMyLists(
      createRepository(vi.fn(() => new Promise<readonly UserListSummary[]>(() => undefined))),
    );

    expect(
      await screen.findByRole('status', { name: 'Carregando suas listas' }),
    ).toBeInTheDocument();
  });

  it('shows an empty call to action', async () => {
    renderMyLists(createRepository(vi.fn().mockResolvedValue([])));

    expect(await screen.findByText('Você ainda não criou nenhuma lista.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar minha primeira lista' })).toHaveAttribute(
      'href',
      '/minhas-listas/nova',
    );
  });

  it('retries a failed list load', async () => {
    const user = userEvent.setup();
    const listSummaries = vi
      .fn()
      .mockRejectedValueOnce(new Error('database detail'))
      .mockResolvedValueOnce([rpgList]);
    renderMyLists(createRepository(listSummaries));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar suas listas. Tente novamente.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: 'RPGs' })).toBeInTheDocument();
    expect(listSummaries).toHaveBeenCalledTimes(2);
  });

  it('renders at most three non-null covers for each list', async () => {
    const listWithSparseCovers = {
      ...rpgList,
      covers: [
        'https://images.example/one.jpg',
        null,
        'https://images.example/two.jpg',
        'https://images.example/three.jpg',
        'https://images.example/four.jpg',
      ],
    } as unknown as UserListSummary;
    renderMyLists(createRepository(vi.fn().mockResolvedValue([listWithSparseCovers])));

    await screen.findByRole('heading', { name: 'RPGs' });
    const covers = screen.getAllByRole('img', { name: /Capa de RPGs/ });
    expect(covers).toHaveLength(3);
    expect(covers.map((cover) => cover.getAttribute('src'))).toEqual([
      'https://images.example/one.jpg',
      'https://images.example/two.jpg',
      'https://images.example/three.jpg',
    ]);
    await waitFor(() =>
      expect(screen.queryByText('Carregando suas listas')).not.toBeInTheDocument(),
    );
  });
});
