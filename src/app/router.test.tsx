import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from './router';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import type { ListsRepository } from '@/features/lists/api/lists-repository';

const dependencyMocks = vi.hoisted(() => ({
  createAuthService: vi.fn(),
  createListsRepository: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

vi.mock('@/shared/supabase/client', () => ({
  getSupabaseClient: dependencyMocks.getSupabaseClient,
}));

vi.mock('@/features/auth/api/auth-service', () => ({
  createSupabaseAuthService: dependencyMocks.createAuthService,
}));

vi.mock('@/features/lists/api/lists-repository', () => ({
  createSupabaseListsRepository: dependencyMocks.createListsRepository,
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

function createControllableAuthService(user: AuthenticatedUser | null) {
  let listener: (nextUser: AuthenticatedUser | null) => void = () => undefined;
  let onSignOut: (() => Promise<void>) | undefined;
  const service = {
    ...createAuthService(user),
    onAuthStateChange: vi.fn((nextListener: (nextUser: AuthenticatedUser | null) => void) => {
      listener = nextListener;
      return vi.fn();
    }),
    signOut: vi.fn(() => onSignOut?.() ?? Promise.resolve()),
  } satisfies AuthService;
  return {
    emit(nextUser: AuthenticatedUser | null) {
      listener(nextUser);
    },
    service,
    setSignOut(nextSignOut: () => Promise<void>) {
      onSignOut = nextSignOut;
    },
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
    dependencyMocks.getSupabaseClient.mockClear();
  });

  it('creates stable default adapters from the exact same client instance', () => {
    const client = {};
    const authService = createAuthService(null);
    const listsRepository = createListsRepository();
    dependencyMocks.getSupabaseClient.mockReturnValue(client);
    dependencyMocks.createAuthService.mockReturnValue(authService);
    dependencyMocks.createListsRepository.mockReturnValue(listsRepository);

    const view = render(<AppRouter />);
    view.rerender(<AppRouter />);

    expect(dependencyMocks.getSupabaseClient).toHaveBeenCalledTimes(1);
    expect(dependencyMocks.createAuthService).toHaveBeenCalledOnce();
    expect(dependencyMocks.createListsRepository).toHaveBeenCalledOnce();
    expect(dependencyMocks.createAuthService).toHaveBeenCalledWith(client);
    expect(dependencyMocks.createListsRepository).toHaveBeenCalledWith(client);
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

  it('preserves the public route subtree when auth changes from loading to authenticated', async () => {
    const auth = createControllableAuthService(null);
    auth.service.getCurrentUser = vi.fn(
      () => new Promise<AuthenticatedUser | null>(() => undefined),
    );
    render(<AppRouter authService={auth.service} listsRepository={createListsRepository()} />);
    const initialHeading = screen.getByRole('heading', { name: 'Zera GameZ' });

    act(() => {
      auth.emit(authenticatedUser);
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Zera GameZ' })).toBe(initialHeading);
    });
  });

  it('finishes logout at home when auth emits null during sign out', async () => {
    const user = userEvent.setup();
    const auth = createControllableAuthService(authenticatedUser);
    auth.setSignOut(() => {
      auth.emit(null);
      return Promise.resolve();
    });
    window.history.replaceState({}, '', '/perfil');
    render(<AppRouter authService={auth.service} listsRepository={createListsRepository()} />);

    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(screen.getByRole('heading', { name: 'Zera GameZ' })).toBeInTheDocument();
  });

  it('releases a failed logout guard and redirects to login after auth emitted null', async () => {
    const user = userEvent.setup();
    const auth = createControllableAuthService(authenticatedUser);
    auth.setSignOut(() => {
      auth.emit(null);
      return Promise.reject(new Error('provider detail'));
    });
    window.history.replaceState({}, '', '/perfil');
    render(<AppRouter authService={auth.service} listsRepository={createListsRepository()} />);

    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(
      await screen.findByRole('heading', { name: 'Entre para continuar' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/entrar');
  });

  it('shows the fixed configuration copy on a private route with a null repository', async () => {
    window.history.replaceState({}, '', '/minhas-listas');
    render(<AppRouter authService={createAuthService(authenticatedUser)} listsRepository={null} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'As listas ainda não estão configuradas.',
    );
  });
});
