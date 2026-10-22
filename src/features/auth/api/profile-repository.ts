import { z } from 'zod';

import { DataError, toDataError } from '@/shared/supabase/data-error';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProfileRecord {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}

export interface ProfileRepository {
  getProfile(userId: string): Promise<ProfileRecord | null>;
  saveProfile(userId: string, displayName: string, avatarUrl: string | null): Promise<void>;
  uploadAvatar(userId: string, file: File): Promise<string>;
}

const avatarBucket = 'zera-profile-photos';
const maxAvatarSize = 5 * 1024 * 1024;
const supportedAvatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const profileRecordSchema = z.object({
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

export function createSupabaseProfileRepository(client: SupabaseClient): ProfileRepository {
  return {
    async getProfile(userId) {
      const response = await client
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (response.error !== null) throw toDataError(response.error);
      const data = profileRecordSchema.nullable().parse(response.data);
      if (data === null) return null;

      return {
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
      };
    },

    async saveProfile(userId, displayName, avatarUrl) {
      const { data, error } = await client
        .from('profiles')
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
        })
        .eq('id', userId)
        .select('id')
        .maybeSingle();

      if (error !== null) throw toDataError(error);
      if (data === null) throw new DataError('unexpected');
    },

    async uploadAvatar(userId, file) {
      if (!supportedAvatarTypes.has(file.type) || file.size > maxAvatarSize) {
        throw new DataError('unexpected');
      }

      const { error } = await client.storage.from(avatarBucket).upload(`${userId}/profile`, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: true,
      });
      if (error !== null) throw toDataError(error);

      const { data } = client.storage.from(avatarBucket).getPublicUrl(`${userId}/profile`);
      return `${data.publicUrl}?v=${String(Date.now())}`;
    },
  };
}
