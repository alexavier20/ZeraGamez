export interface SupabaseConfig {
  readonly publishableKey: string;
  readonly url: string;
}

export type SupabaseConfigState =
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly message: string }
  | { readonly status: 'available'; readonly config: SupabaseConfig };

export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfigState {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url && !publishableKey) return { status: 'missing' };
  if (!url || !publishableKey || !isCredentialFreeHttpUrl(url)) {
    return { status: 'invalid', message: 'A autenticação ainda não está configurada.' };
  }

  return { status: 'available', config: { url, publishableKey } };
}

function isCredentialFreeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}
