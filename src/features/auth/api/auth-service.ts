import { DataError, toDataError } from '@/shared/supabase/data-error';

import { toAuthenticatedUser, type AuthenticatedUser } from '../model/auth';

import type { ProfileRepository } from './profile-repository';

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
  readonly updateUser?: (attributes: {
    readonly data: Readonly<Record<string, unknown>>;
  }) => Promise<{
    readonly data: { readonly user: AuthUserRecord | null };
    readonly error: unknown;
  }>;
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
  readonly profileRepository?: ProfileRepository;
}

export interface ProfileUpdateInput {
  readonly avatarFile?: File | null;
  readonly displayName: string;
}

export interface AuthService {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
  onAuthStateChange(listener: (user: AuthenticatedUser | null) => void): () => void;
  requestEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, token: string): Promise<void>;
  signInWithGoogle(redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
  updateProfile?(input: ProfileUpdateInput): Promise<AuthenticatedUser>;
}

export function createSupabaseAuthService(
  client: SupabaseClientPort,
  options: AuthServiceOptions = {},
): AuthService {
  return {
    async getCurrentUser(): Promise<AuthenticatedUser | null> {
      const response = await callAuth(() => client.auth.getUser());
      throwIfAuthError(response.error);

      if (response.data.user === null) return null;
      const profile = await options.profileRepository?.getProfile(response.data.user.id);
      return toAuthenticatedUser(response.data.user, profile);
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

    async updateProfile(input): Promise<AuthenticatedUser> {
      const displayName = input.displayName.trim();
      const updateUser = client.auth.updateUser;
      if (displayName.length === 0 || displayName.length > 50) {
        throw new DataError('unexpected');
      }
      if (updateUser === undefined) throw new DataError('configuration');

      const currentResponse = await callAuth(() => client.auth.getUser());
      throwIfAuthError(currentResponse.error);
      if (currentResponse.data.user === null) throw new DataError('unauthenticated');

      const currentUser = currentResponse.data.user;
      const previousProfile = await options.profileRepository?.getProfile(currentUser.id);
      let avatarUrl =
        previousProfile?.avatarUrl ??
        readUserMetadata(currentUser.user_metadata, 'avatar_url') ??
        readUserMetadata(currentUser.user_metadata, 'picture');

      if (input.avatarFile !== undefined && input.avatarFile !== null) {
        if (options.profileRepository === undefined) throw new DataError('configuration');
        avatarUrl = await options.profileRepository.uploadAvatar(currentUser.id, input.avatarFile);
      }

      await options.profileRepository?.saveProfile(currentUser.id, displayName, avatarUrl);

      const response = await callAuth(() =>
        updateUser.call(client.auth, {
          data: { display_name: displayName, avatar_url: avatarUrl },
        }),
      );
      throwIfAuthError(response.error);

      const updatedUser = response.data.user ?? {
        ...currentUser,
        user_metadata: {
          ...currentUser.user_metadata,
          display_name: displayName,
          avatar_url: avatarUrl,
        },
      };

      return toAuthenticatedUser(updatedUser, { displayName, avatarUrl });
    },
  };
}

function readUserMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
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
