import { toDataError } from '@/shared/supabase/data-error';

import { toAuthenticatedUser, type AuthenticatedUser } from '../model/auth';

interface AuthUserRecord {
  readonly id: string;
  readonly email?: string;
  readonly user_metadata?: Record<string, unknown>;
}

interface AuthResult {
  readonly error: unknown | null;
}

interface SupabaseAuthPort {
  getUser(): Promise<{
    readonly data: { readonly user: AuthUserRecord | null };
    readonly error: unknown | null;
  }>;
  onAuthStateChange(
    listener: (event: string, session: { readonly user: AuthUserRecord } | null) => void,
  ): { readonly data: { readonly subscription: { readonly unsubscribe: () => void } } };
  signInWithOAuth(credentials: {
    readonly provider: 'google';
    readonly options: { readonly redirectTo: string };
  }): Promise<AuthResult>;
  signInWithOtp(credentials: {
    readonly email: string;
    readonly options: { readonly shouldCreateUser: true };
  }): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  verifyOtp(credentials: {
    readonly email: string;
    readonly token: string;
    readonly type: 'email';
  }): Promise<AuthResult>;
}

interface SupabaseClientPort {
  readonly auth: SupabaseAuthPort;
}

export interface AuthService {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
  onAuthStateChange(listener: (user: AuthenticatedUser | null) => void): () => void;
  requestEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, token: string): Promise<void>;
  signInWithGoogle(redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
}

export function createSupabaseAuthService(client: SupabaseClientPort): AuthService {
  return {
    async getCurrentUser(): Promise<AuthenticatedUser | null> {
      const response = await client.auth.getUser();
      throwIfAuthError(response.error);

      return response.data.user === null ? null : toAuthenticatedUser(response.data.user);
    },

    onAuthStateChange(listener: (user: AuthenticatedUser | null) => void): () => void {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(session === null ? null : toAuthenticatedUser(session.user));
      });

      return data.subscription.unsubscribe;
    },

    async requestEmailCode(email: string): Promise<void> {
      const response = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      throwIfAuthError(response.error);
    },

    async verifyEmailCode(email: string, token: string): Promise<void> {
      const response = await client.auth.verifyOtp({ email, token, type: 'email' });
      throwIfAuthError(response.error);
    },

    async signInWithGoogle(redirectTo: string): Promise<void> {
      const response = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      throwIfAuthError(response.error);
    },

    async signOut(): Promise<void> {
      const response = await client.auth.signOut();
      throwIfAuthError(response.error);
    },
  };
}

function throwIfAuthError(error: unknown | null): void {
  if (error !== null) throw toDataError(error);
}
