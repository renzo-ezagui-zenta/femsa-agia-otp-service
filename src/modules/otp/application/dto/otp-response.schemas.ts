import { z } from 'zod';
import { CustomerSchema } from './send-otp.schema';

/**
 * Convierte un Zod schema a un objeto de schema OpenAPI 3.0.
 * z.toJSONSchema() (nativo Zod 4) emite $schema (draft 2020-12)
 * que no es válido en OpenAPI 3.0, por eso se elimina.
 */
export function toOpenApiSchema(schema: z.ZodType): object {
  const result = z.toJSONSchema(schema) as Record<string, unknown>;
  delete result['$schema'];
  return result;
}

export const SendOtpResponseSchema = z.object({
  sessionId: z.string().uuid().describe('ID único de la sesión OTP generada'),
  expiresAt: z
    .string()
    .describe('Fecha/hora de expiración de la sesión en formato ISO 8601'),
  customer: CustomerSchema,
  sentTo: z.object({
    channel: z
      .enum(['sms', 'mail'])
      .describe('Canal por donde se envió el OTP'),
    value: z
      .string()
      .describe('Destino del OTP: número de teléfono o email según el canal'),
  }),
});

export const VerifyOtpResponseSchema = z.object({
  ok: z
    .literal(true)
    .describe('Siempre true cuando la verificación es exitosa'),
  sessionId: z.string().uuid().describe('ID de la sesión verificada'),
});

export const ErrorResponseSchema = z.object({
  error: z
    .enum(['SESSION_NOT_FOUND', 'INVALID_CODE'])
    .describe('Código de error de negocio'),
});

export const ValidationErrorResponseSchema = z.object({
  formErrors: z.array(z.string()).describe('Errores generales del body'),
  fieldErrors: z
    .record(z.string(), z.array(z.string()))
    .describe(
      'Errores por campo — clave: nombre del campo, valor: lista de mensajes',
    ),
});
