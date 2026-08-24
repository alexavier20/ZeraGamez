import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readSupabaseConfig } from './config';

let supabaseClient: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient !== undefined) return supabaseClient;

  const config = readSupabaseConfig(import.meta.env);
  if (config.status !== 'available') {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(config.config.url, config.config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}
