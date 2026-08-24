import { z } from 'zod';

export const PENDING_AUTH_INTENT_KEY = 'zera-gamez.pending-auth-intent';

const returnToSchema = z.enum([
  '/',
  '/lancamentos',
  '/minhas-listas',
  '/minhas-listas/nova',
  '/perfil',
]);

const pendingAuthIntentSchema = z.discriminatedUnion('type', [
  z.object({
    version: z.literal(1),
    type: z.literal('navigate'),
    returnTo: returnToSchema,
  }),
  z.object({
    version: z.literal(1),
    type: z.literal('open-add-to-lists'),
    returnTo: z.literal('/lancamentos'),
    igdbId: z.number(),
  }),
  z.object({
    version: z.literal(1),
    type: z.literal('toggle-want-to-play'),
    returnTo: z.literal('/lancamentos'),
    igdbId: z.number(),
  }),
]);

export type PendingAuthIntent = z.infer<typeof pendingAuthIntentSchema>;

export function peekPendingAuthIntent(storage: Storage): PendingAuthIntent | null {
  const storedIntent = storage.getItem(PENDING_AUTH_INTENT_KEY);
  if (storedIntent === null) return null;

  try {
    const parsedIntent = pendingAuthIntentSchema.safeParse(JSON.parse(storedIntent));
    if (parsedIntent.success) return parsedIntent.data;
  } catch {
    // Invalid JSON is handled by clearing the intent below.
  }

  clearPendingAuthIntent(storage);
  return null;
}

export function consumePendingAuthIntent(storage: Storage): PendingAuthIntent | null {
  const intent = peekPendingAuthIntent(storage);
  if (intent !== null) clearPendingAuthIntent(storage);
  return intent;
}

export function savePendingAuthIntent(storage: Storage, intent: PendingAuthIntent): void {
  const parsedIntent = pendingAuthIntentSchema.safeParse(intent);

  if (!parsedIntent.success) {
    clearPendingAuthIntent(storage);
    return;
  }

  storage.setItem(PENDING_AUTH_INTENT_KEY, JSON.stringify(parsedIntent.data));
}

export function clearPendingAuthIntent(storage: Storage): void {
  storage.removeItem(PENDING_AUTH_INTENT_KEY);
}
