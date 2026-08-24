import { act, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';

import { AuthProvider, useAuth } from './AuthProvider';

const authenticatedUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'alex@example.com',
  name: 'Alex Xavier',
  initials: 'AX',
  avatarUrl: null,
};

function Probe() {
  const { state } = useAuth();

  return <output>{state.status === 'authenticated' ? state.user.email : state.status}</output>;
}

function createFakeAuthService(
  initialUser: AuthenticatedUser | null | Promise<AuthenticatedUser | null>,
) {
  const listeners = new Set<(user: AuthenticatedUser | null) => void>();
  const unsubscribe = vi.fn();

  const service = {
    getCurrentUser: vi.fn().mockImplementation(() => Promise.resolve(initialUser)),
    onAuthStateChange: vi.fn((listener: (user: AuthenticatedUser | null) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    }),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  } satisfies AuthService;

  return {
    service,
    unsubscribe,
    emit(user: AuthenticatedUser | null): void {
      listeners.forEach((listener) => listener(user));
    },
  };
}

function renderProvider(service: AuthService | null, children: ReactNode = <Probe />) {
  return render(<AuthProvider service={service}>{children}</AuthProvider>);
}

describe('AuthProvider', () => {
  it('loads the current user and follows later auth changes', async () => {
    const fake = createFakeAuthService(null);
    renderProvider(fake.service);

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('anonymous')).toBeInTheDocument();

    act(() => fake.emit(authenticatedUser));

    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
  });

  it('reports unavailable without blocking public descendants', async () => {
    renderProvider(
      null,
      <>
        <Probe />
        <p>Conteúdo público</p>
      </>,
    );

    expect(await screen.findByText('unavailable')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo público')).toBeInTheDocument();
  });

  it('unsubscribes once when it unmounts and ignores a stale initial user', async () => {
    let resolveInitialUser: (user: AuthenticatedUser | null) => void = () => undefined;
    const initialUser = new Promise<AuthenticatedUser | null>((resolve) => {
      resolveInitialUser = resolve;
    });
    const fake = createFakeAuthService(initialUser);
    const { unmount } = renderProvider(fake.service);

    unmount();
    await act(async () => resolveInitialUser(authenticatedUser));

    expect(fake.unsubscribe).toHaveBeenCalledOnce();
  });
});
