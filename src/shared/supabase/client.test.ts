import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient,
}));

describe('getSupabaseClient', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    supabaseMocks.createClient.mockReset();
  });

  it('contains client construction failures and caches unavailable configuration', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example');
    supabaseMocks.createClient.mockImplementation(() => {
      throw new Error('raw client construction detail');
    });
    const { getSupabaseClient } = await import('./client');

    expect(getSupabaseClient()).toBeNull();
    expect(getSupabaseClient()).toBeNull();
    expect(supabaseMocks.createClient).toHaveBeenCalledOnce();
  });
});
