import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/features/auth/context/AuthProvider';
import {
  PENDING_AUTH_INTENT_KEY,
  peekPendingAuthIntent,
  savePendingAuthIntent,
} from '@/features/auth/model/pending-auth-intent';

import { LoginPage } from './LoginPage';

import type { AuthService } from '@/features/auth/api/auth-service';
import type { AuthenticatedUser } from '@/features/auth/model/auth';

const authenticatedUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'alex@example.com',
  name: 'Alex Xavier',
  initials: 'AX',
  avatarUrl: null,
};

function createFakeAuthService(initialUser: AuthenticatedUser | null) {
  const listeners = new Set<(user: AuthenticatedUser | null) => void>();
  return {
    getCurrentUser: vi.fn().mockResolvedValue(initialUser),
    onAuthStateChange: vi.fn((listener: (user: AuthenticatedUser | null) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    requestEmailCode: vi.fn().mockResolvedValue(undefined),
    verifyEmailCode: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    emit(user: AuthenticatedUser | null) {
      listeners.forEach((listener) => {
        listener(user);
      });
    },
  } satisfies AuthService & { emit(user: AuthenticatedUser | null): void };
}

function renderLogin(service: AuthService | null) {
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

  it('does not truncate an eight-digit email OTP', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    const emailInput = document.getElementById('login-email');
    expect(emailInput).toBeInstanceOf(HTMLInputElement);
    await user.type(emailInput as HTMLInputElement, 'alex@example.com');
    await user.click(screen.getByRole('button', { name: /Enviar/ }));

    const codeInput = document.getElementById('login-code');
    expect(codeInput).toBeInstanceOf(HTMLInputElement);
    await user.type(codeInput as HTMLInputElement, '12345678');
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    expect(codeInput).toHaveValue('12345678');
    expect(service.verifyEmailCode).toHaveBeenCalledWith('alex@example.com', '12345678');
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
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveAttribute(
      'aria-describedby',
      'login-email-error',
    );
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveFocus();
    expect(service.requestEmailCode).not.toHaveBeenCalled();
  });

  it('rejects a code outside the supported digit range', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.type(screen.getByRole('textbox', { name: 'Código de verificação' }), '12345');
    await user.click(screen.getByRole('button', { name: 'Confirmar código' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe um código numérico de 6 a 10 dígitos.',
    );
    expect(screen.getByRole('textbox', { name: 'Código de verificação' })).toHaveAttribute(
      'aria-describedby',
      'login-code-error',
    );
    expect(screen.getByRole('textbox', { name: 'Código de verificação' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByRole('textbox', { name: 'Código de verificação' })).toHaveFocus();
    expect(service.verifyEmailCode).not.toHaveBeenCalled();
  });

  it('does not turn a mixed OTP value into a valid code', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    const codeInput = screen.getByRole('textbox', { name: 'Código de verificação' });
    await user.type(codeInput, '123a56');

    expect(codeInput).toHaveValue('123a56');
    await user.click(screen.getByRole('button', { name: 'Confirmar código' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe um código numérico de 6 a 10 dígitos.',
    );
    expect(service.verifyEmailCode).not.toHaveBeenCalled();
  });

  it('accepts a pasted numeric OTP', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.click(screen.getByRole('textbox', { name: 'Código de verificação' }));
    await user.paste('123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar código' }));

    expect(service.verifyEmailCode).toHaveBeenCalledWith('alex@example.com', '123456');
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
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveFocus();

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
    expect(screen.getByRole('status')).toHaveTextContent(
      'Enviamos um novo código para alex@example.com.',
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('returns to the email stage, clears feedback, and focuses the email field', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.type(screen.getByRole('textbox', { name: 'Código de verificação' }), '12345');
    await user.click(screen.getByRole('button', { name: 'Confirmar código' }));
    await user.click(screen.getByRole('button', { name: 'Alterar e-mail' }));

    const emailInput = screen.getByRole('textbox', { name: 'E-mail' });
    expect(emailInput).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(screen.getByRole('textbox', { name: 'Código de verificação' })).toHaveValue('');
  });

  it('announces and blocks duplicate pending email requests', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    service.requestEmailCode.mockImplementation(() => new Promise<void>(() => undefined));
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));

    const submit = screen.getByRole('button', { name: 'Enviando código…' });
    expect(submit).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Enviando código…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await user.click(submit);
    expect(service.requestEmailCode).toHaveBeenCalledTimes(1);
  });

  it('shows generic errors for confirmation, resend, and Google', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    service.verifyEmailCode.mockRejectedValueOnce(new Error('verification provider detail'));
    service.requestEmailCode
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('resend provider detail'));
    service.signInWithGoogle.mockRejectedValueOnce(new Error('oauth provider detail'));
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.type(screen.getByRole('textbox', { name: 'Código de verificação' }), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar código' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir o acesso. Tente novamente.',
    );
    expect(screen.getByRole('textbox', { name: 'Código de verificação' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir o acesso. Tente novamente.',
    );
    expect(screen.getByRole('textbox', { name: 'Código de verificação' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir o acesso. Tente novamente.',
    );
  });

  it('returns focus to the code field after an async resend error', async () => {
    const user = userEvent.setup();
    const service = createFakeAuthService(null);
    service.requestEmailCode
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('resend provider detail'));
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir o acesso. Tente novamente.',
    );
    expect(screen.getByRole('textbox', { name: 'Código de verificação' })).toHaveFocus();
  });

  it('shows unavailable configuration and disables authentication actions', async () => {
    renderLogin(null);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A autenticação ainda não está configurada.',
    );
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeDisabled();
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

    await waitFor(() => {
      expect(window.location.pathname).toBe('/minhas-listas');
    });
    expect(peekPendingAuthIntent(sessionStorage)).toBeNull();
  });

  it('resumes a protected route after an auth state change following code verification', async () => {
    const user = userEvent.setup();
    sessionStorage.clear();
    savePendingAuthIntent(sessionStorage, {
      version: 1,
      type: 'navigate',
      returnTo: '/minhas-listas',
    });
    const service = createFakeAuthService(null);
    renderLogin(service);

    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.type(screen.getByRole('textbox', { name: 'Código de verificação' }), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar código' }));
    expect(window.location.pathname).toBe('/entrar');

    act(() => {
      service.emit(authenticatedUser);
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/minhas-listas');
    });
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

    await waitFor(() => {
      expect(window.location.pathname).toBe('/lancamentos');
    });
    expect(peekPendingAuthIntent(sessionStorage)).toEqual({
      version: 1,
      type: 'open-add-to-lists',
      returnTo: '/lancamentos',
      igdbId: 7346,
    });
    sessionStorage.removeItem(PENDING_AUTH_INTENT_KEY);
  });
});
