import { describe, expect, it } from 'vitest';

import { readSupabaseConfig } from './config';

describe('readSupabaseConfig', () => {
  it('keeps public pages available when both values are absent', () => {
    expect(readSupabaseConfig({})).toEqual({ status: 'missing' });
  });

  it('rejects partial configuration without exposing its value', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://project.supabase.co' })).toEqual({
      status: 'invalid',
      message: 'A autenticação ainda não está configurada.',
    });
  });

  it('accepts a valid URL and publishable key', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({
      status: 'available',
      config: {
        url: 'https://project.supabase.co',
        publishableKey: 'sb_publishable_example',
      },
    });
  });

  it.each([
    ['a non-HTTP protocol', 'javascript:alert(1)'],
    ['embedded credentials', 'https://user:secret@project.supabase.co'],
  ])('rejects %s without exposing the configured value', (_label, url) => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({
      status: 'invalid',
      message: 'A autenticação ainda não está configurada.',
    });
  });

  it('accepts credential-free HTTP for local Supabase development', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toMatchObject({ status: 'available' });
  });
});
