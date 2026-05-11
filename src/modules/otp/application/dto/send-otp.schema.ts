import { z } from 'zod';

export const CustomerSchema = z.object({
  id: z.string().min(1).describe('Identificador único del cliente'),
  name: z.string().min(1).describe('Nombre completo del cliente'),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'INVALID_PHONE')
    .describe('Teléfono en formato E.164 (ej: +56912345678)'),
  mail: z
    .string()
    .email('INVALID_MAIL')
    .describe('Dirección de correo electrónico'),
});

export const SendOtpSchema = z.object({
  customer: CustomerSchema,
  requestedVia: z
    .enum(['mail', 'phone', 'id'])
    .describe(
      'Canal por el que el usuario se identificó. ' +
        'Lógica de canal cruzado: mail → SMS, phone → email, id → SMS.',
    ),
});

export type SendOtpDto = z.infer<typeof SendOtpSchema>;
