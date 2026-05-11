import { BadRequestException } from '@nestjs/common';
import { OtpController } from '../../../../../src/modules/otp/infrastructure/http/otp.controller';
import type { SendOtpUseCase } from '../../../../../src/modules/otp/application/use-cases/send-otp.use-case';
import type { VerifyOtpUseCase } from '../../../../../src/modules/otp/application/use-cases/verify-otp.use-case';
import { ZodValidationPipe } from '../../../../../src/shared/pipes/zod-validation.pipe';
import { SendOtpSchema } from '../../../../../src/modules/otp/application/dto/send-otp.schema';
import { VerifyOtpSchema } from '../../../../../src/modules/otp/application/dto/verify-otp.schema';

const VALID_SEND_BODY = {
  customer: {
    id: 'cust-1',
    name: 'Ana García',
    phone: '+56912345678',
    mail: 'ana@example.com',
  },
  requestedVia: 'id',
};

const VALID_VERIFY_BODY = {
  sessionId: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
  code: '123456',
};

const SEND_RESULT = {
  sessionId: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
  expiresAt: new Date(Date.now() + 300000).toISOString(),
  customer: VALID_SEND_BODY.customer,
  sentTo: { channel: 'sms', value: '+56912345678' },
};

const VERIFY_RESULT = {
  ok: true as const,
  sessionId: VALID_VERIFY_BODY.sessionId,
};

function makeController() {
  const sendOtpUseCase = {
    execute: jest.fn().mockResolvedValue(SEND_RESULT),
  } as unknown as jest.Mocked<SendOtpUseCase>;

  const verifyOtpUseCase = {
    execute: jest.fn().mockResolvedValue(VERIFY_RESULT),
  } as unknown as jest.Mocked<VerifyOtpUseCase>;

  const controller = new OtpController(sendOtpUseCase, verifyOtpUseCase);
  return { controller, sendOtpUseCase, verifyOtpUseCase };
}

describe('OtpController', () => {
  describe('send()', () => {
    it('delega al SendOtpUseCase y retorna su resultado', async () => {
      const { controller, sendOtpUseCase } = makeController();
      const dto = new ZodValidationPipe(SendOtpSchema).transform(
        VALID_SEND_BODY,
      );
      const result = await controller.send(dto);
      expect(sendOtpUseCase.execute).toHaveBeenCalledWith(dto);
      expect(result).toEqual(SEND_RESULT);
    });

    it('ZodValidationPipe lanza BadRequestException con body inválido (sin requestedVia)', () => {
      const pipe = new ZodValidationPipe(SendOtpSchema);
      expect(() =>
        pipe.transform({ customer: VALID_SEND_BODY.customer }),
      ).toThrow(BadRequestException);
    });

    it('ZodValidationPipe lanza BadRequestException con phone inválido', () => {
      const pipe = new ZodValidationPipe(SendOtpSchema);
      const body = {
        ...VALID_SEND_BODY,
        customer: { ...VALID_SEND_BODY.customer, phone: 'bad' },
      };
      expect(() => pipe.transform(body)).toThrow(BadRequestException);
    });

    it('ZodValidationPipe lanza BadRequestException con body vacío', () => {
      const pipe = new ZodValidationPipe(SendOtpSchema);
      expect(() => pipe.transform({})).toThrow(BadRequestException);
    });
  });

  describe('verify()', () => {
    it('delega al VerifyOtpUseCase y retorna su resultado', async () => {
      const { controller, verifyOtpUseCase } = makeController();
      const dto = new ZodValidationPipe(VerifyOtpSchema).transform(
        VALID_VERIFY_BODY,
      );
      const result = await controller.verify(dto);
      expect(verifyOtpUseCase.execute).toHaveBeenCalledWith(dto);
      expect(result).toEqual(VERIFY_RESULT);
    });

    it('ZodValidationPipe lanza BadRequestException con sessionId inválido', () => {
      const pipe = new ZodValidationPipe(VerifyOtpSchema);
      expect(() =>
        pipe.transform({ sessionId: 'not-uuid', code: '123456' }),
      ).toThrow(BadRequestException);
    });

    it('ZodValidationPipe lanza BadRequestException con code de 5 dígitos', () => {
      const pipe = new ZodValidationPipe(VerifyOtpSchema);
      expect(() =>
        pipe.transform({
          sessionId: VALID_VERIFY_BODY.sessionId,
          code: '12345',
        }),
      ).toThrow(BadRequestException);
    });

    it('ZodValidationPipe lanza BadRequestException con body vacío', () => {
      const pipe = new ZodValidationPipe(VerifyOtpSchema);
      expect(() => pipe.transform({})).toThrow(BadRequestException);
    });
  });
});
