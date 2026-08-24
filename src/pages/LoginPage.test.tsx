import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { AuthService } from '@/features/auth/api/auth-service';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import {
  PENDING_AUTH_INTENT_KEY,
  peekPendingAuthIntent,
  savePendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';

import { LoginPage } from './LoginPage';

const authenticatedUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'alex@example.com',
  name: 'Alex Xavier',
  initials: 'AX',
  avatarUrl: null,
};

function createFakeAuthService(initialUser: AuthenticatedUser | null) {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(initialUser),
    onAuthStateChange: vi.fn(() => vi.fn()),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  } satisfies AuthService;
}

function renderLogin(service: AuthService) {
  window.history.replaceState({}, '', '/entrar');
  return render(
    <AuthProvider service={service}>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
  it('requests a normalized email code and verifies six digits', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), ' alex@example.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));

    expect(service.requestEmailCode).toHaveBeenCalledWith('alex@example.com');
    await user.type(screen.getByRole('textbox', { name: 'Código de verificação' }), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar código' }));

    expect(service.verifyEmailCode).toHaveBeenCalledWith('alex@example.com', '123456');
  });

  it('starts Google with the dedicated callback', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));

    expect(service.signInWithGoogle).toHaveBeenCalledWith(`${window.location.origin}/entrar`);
  });

  it('rejects an invalid email without calling the service', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'não-é-email');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.');
    expect(service.requestEmailCode).not.toHaveBeenCalled();
  });

  it('rejects a code that does not contain six digits', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.type(screen.getByRole('textbox', { name: 'Código de verificação' }), '12345');
    await user.click(screen.getByRole('button', { name: 'Confirmar código' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe o código de 6 dígitos.');
    expect(service.verifyEmailCode).not.toHaveBeenCalled();
  });

  it('shows a generic error after a failed code request and permits retry without losing email', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    service.requestEmailCode.mockRejectedValueOnce(new Error('provider detail'));
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), ' alex@example.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir o acesso. Tente novamente.',
    );
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveValue('alex@example.com');

    await user.click(screen.getByRole('button', { name: 'Enviar código' }));

    expect(service.requestEmailCode).toHaveBeenLastCalledWith('alex@example.com');
    expect(screen.getByRole('textbox', { name: 'Código de verificação' })).toBeInTheDocument();
  });

  it('resends the code without losing the normalized email', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), ' alex@example.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(service.requestEmailCode).toHaveBeenLastCalledWith('alex@example.com');
    expect(screen.getByRole('status')).toHaveTextContent('Enviamos um novo código para alex@example.com.');
  });

  it('resumes a protected route after authentication', async () => {
    sessionStorage.clear();
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'navigate',
      returnTo: '/minhas-listas',
    });
    const service = createFakeAuthService(authenticatedUser);
    renderLogin(service);

    await waitFor(() => expect(window.location.pathname).toBe('/minhas-listas'));
    expect(peekPendingAuthIntent(sessionStorage)).toBeNull();
  });

  it('retains a release action intent while returning to releases after authentication', async () => {
    sessionStorage.clear();
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'open-add-to-lists',
      returnTo: '/lancamentos',
      igdbId: 7346,
    });
    const service = createFakeAuthService(authenticatedUser);
    renderLogin(service);

    await waitFor(() => expect(window.location.pathname).toBe('/lancamentos'));
    expect(peekPendingAuthIntent(sessionStorage)).toEqual({
      version: 1,
      type: 'open-add-to-lists',
      returnTo: '/lancamentos',
      igdbId: 7346,
    });
    sessionStorage.removeItem(PENDING_AUTH_INTENT_KEY);
  });
});
