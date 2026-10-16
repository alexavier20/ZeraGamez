import { readSupabaseConfig } from './config';

interface AuthSettings {
  readonly external?: {
    readonly google?: unknown;
  };
}

export async function isGoogleAuthProviderEnabled(): Promise<boolean> {
  const state = readSupabaseConfig(import.meta.env);
  if (state.status !== 'available') throw new Error('Supabase Auth is not configured.');

  const response = await fetch(`${state.config.url.replace(/\/+$/, '')}/auth/v1/settings`, {
    headers: {
      apikey: state.config.publishableKey,
      Authorization: `Bearer ${state.config.publishableKey}`,
    },
  });
  if (!response.ok) throw new Error('Unable to read Supabase Auth settings.');

  const settings = (await response.json()) as AuthSettings;
  if (typeof settings.external?.google !== 'boolean') {
    throw new Error('Google provider setting is unavailable.');
  }

  return settings.external.google;
}
