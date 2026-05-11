import { z } from 'zod';

export const EnvSchema = z
  .object({
    VALKEY_URL: z.string().min(1),
    OTP_TTL_SECONDS: z.coerce.number().positive().default(300),
    AWS_REGION: z.string().min(1),
    AWS_PROFILE: z.string().optional(),
    SES_FROM_ADDRESS: z.string().email(),
    EUM_ORIGINATION_IDENTITY: z.string().optional(),
    EUM_MOCK: z.string().optional(),
    PORT: z.coerce.number().positive().default(3000),
    NODE_ENV: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
  })
  .refine((env) => env.EUM_MOCK === 'true' || !!env.EUM_ORIGINATION_IDENTITY, {
    message: 'EUM_ORIGINATION_IDENTITY is required when EUM_MOCK is not "true"',
    path: ['EUM_ORIGINATION_IDENTITY'],
  });

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const lines = Object.entries(errors)
      .map(([field, messages]) => `  ${field}: ${messages?.join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${lines}`);
  }
  return result.data;
}
