import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from './router';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import type { ListsRepository } from '@/features/lists/api/lists-repository';

const getSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/supabase/client', () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

const authenticatedUser: AuthenticatedUser = {
  avatarUrl: null,
  email: 'alex@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  initials: 'AX',
  name: 'Alex Xavier',
};

function createAuthService(user: AuthenticatedUser | null): AuthService {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
    onAuthStateChange: vi.fn(() => vi.fn()),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function createListsRepository(): ListsRepository {
  return {
    addGameToLists: vi.fn().mockResolvedValue([]),
    createList: vi.fn(),
    getWantToPlayIds: vi.fn().mockResolvedValue(new Set<number>()),
    listSummaries: vi.fn().mockResolvedValue([]),
    toggleWantToPlay: vi.fn().mockResolvedValue(false),
  };
}

describe('AppRouter', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    sessionStorage.clear();
    getSupabaseClientMock.mockClear();
  });

  it('keeps the default auth service resolution stable across rerenders', () => {
    getSupabaseClientMock.mockReturnValue(null);

    const view = render(<AppRouter />);
    view.rerender(<AppRouter />);

    expect(getSupabaseClientMock).toHaveBeenCalledTimes(1);
  });

  it('keeps public pages renderable when auth and lists are unconfigured', () => {
    render(<AppRouter authService={null} listsRepository={null} />);

    expect(screen.getByRole('heading', { name: 'Zera GameZ' })).toBeInTheDocument();
  });

  it.each(['/minhas-listas', '/minhas-listas/nova', '/perfil'])(
    'protects the private route %s for anonymous users',
    async (path) => {
      window.history.replaceState({}, '', path);
      render(
        <AppRouter
          authService={createAuthService(null)}
          listsRepository={createListsRepository()}
        />,
      );

      expect(
        await screen.findByRole('heading', { name: 'Entre para continuar' }),
      ).toBeInTheDocument();
      expect(window.location.pathname).toBe('/entrar');
    },
  );

  it.each([
    ['/minhas-listas', 'Minhas listas'],
    ['/minhas-listas/nova', 'Criar lista'],
    ['/perfil', 'Perfil'],
  ])('renders the authenticated private route %s', async (path, heading) => {
    window.history.replaceState({}, '', path);
    render(
      <AppRouter
        authService={createAuthService(authenticatedUser)}
        listsRepository={createListsRepository()}
      />,
    );

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
