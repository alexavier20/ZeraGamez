export interface AuthenticatedUser {
  readonly avatarUrl: string | null;
  readonly email: string;
  readonly id: string;
  readonly initials: string;
  readonly name: string;
}

interface AuthUserRecord {
  readonly id: string;
  readonly email?: string;
  readonly user_metadata?: Record<string, unknown>;
}

const OTP_ERROR_MESSAGE = 'Digite o código de seis dígitos.';

export function toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
  const email = user.email ?? '';
  const fullName = readMetadataString(user.user_metadata, 'full_name');
  const name = fullName ?? email;

  return {
    id: user.id,
    email,
    name,
    initials: toInitials(fullName ?? email),
    avatarUrl: readMetadataString(user.user_metadata, 'avatar_url'),
  };
}

export function normalizeOtp(value: string): string {
  const otp = value.trim();

  if (!/^\d{6}$/.test(otp)) {
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
