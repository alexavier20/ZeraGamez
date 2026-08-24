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
  if (!url || !publishableKey || !URL.canParse(url)) {
    return { status: 'invalid', message: 'A autenticação ainda não está configurada.' };
  }

  return { status: 'available', config: { url, publishableKey } };
}
