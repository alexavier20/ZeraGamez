import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import {
  PENDING_AUTH_INTENT_KEY,
  savePendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';

import { ProfilePage } from './ProfilePage';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';

const authenticatedUser: AuthenticatedUser = {
  avatarUrl: null,
  email: 'alex@example.com',
  id: '11111111-1111-4111-8111-111111111111',
  initials: 'AX',
  name: 'Alex Xavier',
};

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function createAuthService(
  signOut: AuthService['signOut'],
  user: AuthenticatedUser = authenticatedUser,
): AuthService {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
    onAuthStateChange: vi.fn(() => vi.fn()),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut,
  };
}

function renderProfile(service: AuthService) {
  render(
    <AuthProvider service={service}>
      <MemoryRouter initialEntries={['/perfil']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<ProfilePage />} path="/perfil" />
          </Route>
          <Route element={<h1>Início público</h1>} path="/" />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('ProfilePage', () => {
  it('shows the user email and initials when there is no avatar', async () => {
    renderProfile(createAuthService(vi.fn().mockResolvedValue(undefined)));

    expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('AX')).toHaveAttribute('aria-label', 'Avatar de Alex Xavier');
    expect(screen.queryByRole('img', { name: 'Avatar de Alex Xavier' })).not.toBeInTheDocument();
  });

  it('shows the account avatar when available', async () => {
    const userWithAvatar = {
      ...authenticatedUser,
      avatarUrl: 'https://images.example/avatar.jpg',
    };
    renderProfile(createAuthService(vi.fn().mockResolvedValue(undefined), userWithAvatar));

    expect(await screen.findByRole('img', { name: 'Avatar de Alex Xavier' })).toHaveAttribute(
      'src',
      userWithAvatar.avatarUrl,
    );
    expect(screen.queryByText('AX')).not.toBeInTheDocument();
  });

  it('clears pending intent, awaits sign out, and only then returns home', async () => {
    const user = userEvent.setup();
    const pendingSignOut = deferred<undefined>();
    const signOut = vi.fn(() => pendingSignOut.promise);
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'navigate',
      returnTo: '/minhas-listas',
    });
    renderProfile(createAuthService(signOut));

    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(PENDING_AUTH_INTENT_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: 'Saindo…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saindo…');
    expect(screen.queryByRole('heading', { name: 'Início público' })).not.toBeInTheDocument();

    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'navigate',
      returnTo: '/perfil',
    });
    await act(async () => {
      pendingSignOut.resolve(undefined);
      await pendingSignOut.promise;
    });

    expect(await screen.findByRole('heading', { name: 'Início público' })).toBeInTheDocument();
    expect(sessionStorage.getItem(PENDING_AUTH_INTENT_KEY)).toBeNull();
  });

  it('stays on profile and shows a sanitized error when sign out fails', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockRejectedValue(new Error('provider detail'));
    renderProfile(createAuthService(signOut));

    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível sair. Tente novamente.',
    );
    expect(screen.queryByText('provider detail')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled());
  });
});
