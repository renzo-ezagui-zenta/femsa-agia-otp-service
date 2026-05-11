import { z } from 'zod';

export const VerifyOtpSchema = z.object({
  sessionId: z
    .string()
    .uuid()
    .describe('ID de sesión devuelto por POST /otp/send'),
  code: z
    .string()
    .regex(/^\d{6}$/, 'Must be exactly 6 digits')
    .describe('Código OTP de exactamente 6 dígitos'),
});

export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
