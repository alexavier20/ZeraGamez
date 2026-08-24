import { describe, expect, it, vi } from 'vitest';

import { DataError } from '@/shared/supabase/data-error';

import { createSupabaseAuthService } from './auth-service';

const rawUser = {
  id: 'user-1',
  email: 'alex@example.com',
  user_metadata: {
    full_name: 'Alex Xavier',
    avatar_url: 'https://img.example/alex.png',
  },
};

type AuthStateListener = (event: string, session: { user: typeof rawUser } | null) => void;

function createAuthPort(user: typeof rawUser | null = rawUser) {
  let listener: AuthStateListener | null = null;
  const unsubscribe = vi.fn();
  const port = {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn((nextListener: AuthStateListener) => {
      listener = nextListener;
      return { data: { subscription: { unsubscribe } } };
    }),
  };

  return {
    port,
    emit(event: string, session: { user: typeof rawUser } | null): void {
      listener?.(event, session);
    },
    unsubscribe,
  };
}

describe('createSupabaseAuthService', () => {
  it('requests an email OTP without disabling new-account creation', async () => {
    const fake = createAuthPort();
    const service = createSupabaseAuthService({ auth: fake.port });

    await service.requestEmailCode('alex@example.com');

    expect(fake.port.signInWithOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('verifies an email OTP with Supabase email token semantics', async () => {
    const fake = createAuthPort();
    const service = createSupabaseAuthService({ auth: fake.port });

    await service.verifyEmailCode('alex@example.com', '123456');

    expect(fake.port.verifyOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('starts Google OAuth with the supplied application callback URL', async () => {
    const fake = createAuthPort();
    const service = createSupabaseAuthService({ auth: fake.port });

    await service.signInWithGoogle('https://zera.example/entrar');

    expect(fake.port.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://zera.example/entrar' },
    });
  });

  it('maps the current SDK user to the application user shape', async () => {
    const fake = createAuthPort();
    const service = createSupabaseAuthService({ auth: fake.port });

    await expect(service.getCurrentUser()).resolves.toEqual({
      id: 'user-1',
      email: 'alex@example.com',
      name: 'Alex Xavier',
      initials: 'AX',
      avatarUrl: 'https://img.example/alex.png',
    });
  });

  it('forwards normalized auth changes and unsubscribes on cleanup', () => {
    const fake = createAuthPort();
    const service = createSupabaseAuthService({ auth: fake.port });
    const listener = vi.fn();

    const stop = service.onAuthStateChange(listener);
    fake.emit('SIGNED_IN', { user: rawUser });
    fake.emit('SIGNED_OUT', null);
    stop();

    expect(listener).toHaveBeenNthCalledWith(1, {
      id: 'user-1',
      email: 'alex@example.com',
      name: 'Alex Xavier',
      initials: 'AX',
      avatarUrl: 'https://img.example/alex.png',
    });
    expect(listener).toHaveBeenNthCalledWith(2, null);
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('signs out through the SDK auth client', async () => {
    const fake = createAuthPort();
    const service = createSupabaseAuthService({ auth: fake.port });

    await service.signOut();

    expect(fake.port.signOut).toHaveBeenCalledTimes(1);
  });

  it('sanitizes a provider error without exposing its message', async () => {
    const fake = createAuthPort();
    fake.port.signInWithOtp.mockResolvedValue({
      data: {},
      error: new Error('The provider revealed sensitive details.'),
    });
    const service = createSupabaseAuthService({ auth: fake.port });

    await expect(service.requestEmailCode('alex@example.com')).rejects.toEqual(
      expect.objectContaining({
        name: 'DataError',
        code: 'unexpected',
        message: 'Algo deu errado. Tente novamente.',
      }),
    );
    await expect(service.requestEmailCode('alex@example.com')).rejects.toBeInstanceOf(DataError);
  });

  it('sanitizes a rejected current-user provider promise', async () => {
    const fake = createAuthPort();
    fake.port.getUser.mockRejectedValue(new Error('Provider rejection: current user.'));
    const service = createSupabaseAuthService({ auth: fake.port });

    await expect(service.getCurrentUser()).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });

  it('sanitizes a rejected email-code request provider promise', async () => {
    const fake = createAuthPort();
    fake.port.signInWithOtp.mockRejectedValue(new Error('Provider rejection: email code.'));
    const service = createSupabaseAuthService({ auth: fake.port });

    await expect(service.requestEmailCode('alex@example.com')).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });

  it('sanitizes a rejected email-code verification provider promise', async () => {
    const fake = createAuthPort();
    fake.port.verifyOtp.mockRejectedValue(new Error('Provider rejection: verify code.'));
    const service = createSupabaseAuthService({ auth: fake.port });

    await expect(service.verifyEmailCode('alex@example.com', '123456')).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });

  it('sanitizes a rejected Google OAuth provider promise', async () => {
    const fake = createAuthPort();
    fake.port.signInWithOAuth.mockRejectedValue(new Error('Provider rejection: Google OAuth.'));
    const service = createSupabaseAuthService({ auth: fake.port });

    await expect(service.signInWithGoogle('https://zera.example/entrar')).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });

  it('sanitizes a rejected sign-out provider promise', async () => {
    const fake = createAuthPort();
    fake.port.signOut.mockRejectedValue(new Error('Provider rejection: sign out.'));
    const service = createSupabaseAuthService({ auth: fake.port });

    await expect(service.signOut()).rejects.toMatchObject({
      name: 'DataError',
      code: 'unexpected',
      message: 'Algo deu errado. Tente novamente.',
    });
  });
});
