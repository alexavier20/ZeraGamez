import { describe, expect, it } from 'vitest';

import { normalizeOtp, toAuthenticatedUser } from './auth';

describe('toAuthenticatedUser', () => {
  it('normalizes Google metadata and falls back to the email for initials', () => {
    expect(
      toAuthenticatedUser({
        id: 'user-1',
        email: 'alex@example.com',
        user_metadata: {
          full_name: 'Alex Xavier',
          avatar_url: 'https://img.example/alex.png',
        },
      }),
    ).toEqual({
      id: 'user-1',
      email: 'alex@example.com',
      name: 'Alex Xavier',
      initials: 'AX',
      avatarUrl: 'https://img.example/alex.png',
    });

    expect(
      toAuthenticatedUser({
        id: 'user-2',
        email: 'alex@example.com',
        user_metadata: {},
      }),
    ).toMatchObject({ name: 'alex@example.com', initials: 'A', avatarUrl: null });
  });
});

describe('normalizeOtp', () => {
  it('accepts numeric OTP values from six to ten digits', () => {
    expect(normalizeOtp(' 123456 ')).toBe('123456');
    expect(normalizeOtp(' 12345678 ')).toBe('12345678');
    expect(normalizeOtp(' 1234567890 ')).toBe('1234567890');
  });

  it('rejects OTP values that contain non-digits or the wrong length', () => {
    expect(() => normalizeOtp('12345a')).toThrow('Digite um código numérico de 6 a 10 dígitos.');
    expect(() => normalizeOtp('12345')).toThrow('Digite um código numérico de 6 a 10 dígitos.');
    expect(() => normalizeOtp('12345678901')).toThrow(
      'Digite um código numérico de 6 a 10 dígitos.',
    );
  });
});
