import { DataError, toDataError } from '@/shared/supabase/data-error';

import { toAuthenticatedUser, type AuthenticatedUser } from '../model/auth';

interface AuthUserRecord {
  readonly id: string;
  readonly email?: string;
  readonly user_metadata?: Record<string, unknown>;
}

interface AuthResult {
  readonly error: unknown;
}

interface SupabaseAuthPort {
  getUser(): Promise<{
    readonly data: { readonly user: AuthUserRecord | null };
    readonly error: unknown;
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

interface AuthServiceOptions {
  readonly isGoogleProviderEnabled?: () => Promise<boolean>;
}

export interface AuthService {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
  onAuthStateChange(listener: (user: AuthenticatedUser | null) => void): () => void;
  requestEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, token: string): Promise<void>;
  signInWithGoogle(redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
}

export function createSupabaseAuthService(
  client: SupabaseClientPort,
  options: AuthServiceOptions = {},
): AuthService {
  return {
    async getCurrentUser(): Promise<AuthenticatedUser | null> {
      const response = await callAuth(() => client.auth.getUser());
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
      const response = await callAuth(() =>
        client.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        }),
      );
      throwIfAuthError(response.error);
    },

    async verifyEmailCode(email: string, token: string): Promise<void> {
      const response = await callAuth(() => client.auth.verifyOtp({ email, token, type: 'email' }));
      throwIfAuthError(response.error);
    },

    async signInWithGoogle(redirectTo: string): Promise<void> {
      if (options.isGoogleProviderEnabled !== undefined) {
        let providerEnabled: boolean;
        try {
          providerEnabled = await options.isGoogleProviderEnabled();
        } catch (error) {
          throw toDataError(error);
        }
        if (!providerEnabled) throw new DataError('google_provider_disabled');
      }

      let response: AuthResult;
      try {
        response = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
      } catch (error) {
        if (isGoogleProviderDisabledError(error)) {
          throw new DataError('google_provider_disabled');
        }
        throw toDataError(error);
      }

      if (isGoogleProviderDisabledError(response.error)) {
        throw new DataError('google_provider_disabled');
      }
      throwIfAuthError(response.error);
    },

    async signOut(): Promise<void> {
      const response = await callAuth(() => client.auth.signOut());
      throwIfAuthError(response.error);
    },
  };
}

function isGoogleProviderDisabledError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as { readonly message?: unknown; readonly msg?: unknown };
  return [candidate.message, candidate.msg].some(
    (message) =>
      typeof message === 'string' &&
      /unsupported provider:\s*provider is not enabled/i.test(message),
  );
}

function throwIfAuthError(error: unknown): void {
  if (error !== null) throw toDataError(error);
}

async function callAuth<Result>(operation: () => Promise<Result>): Promise<Result> {
  try {
    return await operation();
  } catch (error) {
    throw toDataError(error);
  }
}
