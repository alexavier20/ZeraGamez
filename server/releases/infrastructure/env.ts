import { z } from 'zod';

import { ServiceUnavailableError } from './upstream-errors';

const environmentSchema = z.object({
  IGDB_CLIENT_ID: z.string().trim().min(1),
  IGDB_CLIENT_SECRET: z.string().trim().min(1),
});

export interface IgdbEnvironment {
  clientId: string;
  clientSecret: string;
}

export function readIgdbEnvironment(environment: NodeJS.ProcessEnv): IgdbEnvironment {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new ServiceUnavailableError('Configuração da integração indisponível.');
  }
  return {
    clientId: result.data.IGDB_CLIENT_ID,
    clientSecret: result.data.IGDB_CLIENT_SECRET,
  };
}
