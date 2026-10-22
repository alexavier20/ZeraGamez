export interface AuthenticatedUser {
  readonly avatarUrl: string | null;
  readonly email: string;
  readonly id: string;
  readonly initials: string;
  readonly name: string;
}

export interface AuthProfile {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}

interface AuthUserRecord {
  readonly id: string;
  readonly email?: string;
  readonly user_metadata?: Record<string, unknown>;
}

const OTP_ERROR_MESSAGE = 'Digite um código numérico de 6 a 10 dígitos.';

export function toAuthenticatedUser(
  user: AuthUserRecord,
  profile?: AuthProfile | null,
): AuthenticatedUser {
  const email = user.email ?? '';
  const metadataName =
    readMetadataString(user.user_metadata, 'display_name') ??
    readMetadataString(user.user_metadata, 'full_name') ??
    readMetadataString(user.user_metadata, 'name');
  const profileName = profile?.displayName?.trim();
  const name = (profileName === '' ? null : profileName) ?? metadataName ?? email;

  return {
    id: user.id,
    email,
    name,
    initials: toInitials(name),
    avatarUrl:
      profile?.avatarUrl ??
      readMetadataString(user.user_metadata, 'avatar_url') ??
      readMetadataString(user.user_metadata, 'picture'),
  };
}

export function normalizeOtp(value: string): string {
  const otp = value.trim();

  if (!/^\d{6,10}$/.test(otp)) {
    throw new Error(OTP_ERROR_MESSAGE);
  }

  return otp;
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];

  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return normalized || null;
}

function toInitials(value: string): string {
  const words = (value.includes('@') ? value.split('@')[0] : value)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  return (
    words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'
  );
}
