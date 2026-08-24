import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { AuthService } from '@/features/auth/api/auth-service';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import {
  PENDING_AUTH_INTENT_KEY,
  peekPendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';

import { ProtectedRoute } from './ProtectedRoute';

const authenticatedUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'alex@example.com',
  name: 'Alex Xavier',
  initials: 'AX',
  avatarUrl: null,
};

function createFakeAuthService(
  initialUser: AuthenticatedUser | null | Promise<AuthenticatedUser | null>,
) {
  return {
    getCurrentUser: vi.fn().mockImplementation(() => Promise.resolve(initialUser)),
    onAuthStateChange: vi.fn(() => vi.fn()),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  } satisfies AuthService;
}

function renderGuard(service: AuthService | null, initialEntry = '/minhas-listas/nova') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          element={
            <AuthProvider service={service}>
              <ProtectedRoute>
                <p>Conteúdo privado</p>
              </ProtectedRoute>
            </AuthProvider>
          }
          path="/minhas-listas/nova"
        />
        <Route element={<h1>Entrar</h1>} path="/entrar" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a named loading state before deciding', () => {
    renderGuard(createFakeAuthService(new Promise(() => undefined)));

    expect(screen.getByRole('status')).toHaveTextContent('Verificando sua sessão');
  });

  it('stores the protected route and sends anonymous users to login', async () => {
    sessionStorage.removeItem(PENDING_AUTH_INTENT_KEY);
    renderGuard(createFakeAuthService(null));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(peekPendingAuthIntent(sessionStorage)).toEqual({
      version: 1,
      type: 'navigate',
      returnTo: '/minhas-listas/nova',
    });
  });

  it('renders protected children for an authenticated user', async () => {
    renderGuard(createFakeAuthService(authenticatedUser));

    expect(await screen.findByText('Conteúdo privado')).toBeInTheDocument();
  });

  it('sends unavailable auth configuration to login', async () => {
    renderGuard(null);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});
