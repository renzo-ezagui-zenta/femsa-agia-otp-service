import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VerifyOtpUseCase } from '../../../../../src/modules/otp/application/use-cases/verify-otp.use-case';
import type { OtpSessionRepositoryPort } from '../../../../../src/modules/otp/domain/ports/otp-session-repository.port';
import {
  computeHmac,
  encrypt,
} from '../../../../../src/shared/crypto/otp-crypto';
import { mockLogger } from '../../../../helpers/logger.mock';

const TEST_HMAC_SECRET = 'test-hmac-secret-that-is-at-least-32-chars!!';
const TEST_ENCRYPTION_KEY = '00'.repeat(32);

const SESSION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const CORRECT_CODE = '123456';

const CUSTOMER = {
  id: 'c1',
  name: 'Ana',
  phone: '+56912345678',
  mail: 'ana@example.com',
};

function buildSession(expiresOffset = 300) {
  return {
    otpHash: computeHmac(CORRECT_CODE, TEST_HMAC_SECRET),
    customerEncrypted: encrypt(JSON.stringify(CUSTOMER), TEST_ENCRYPTION_KEY),
    expiresAt: Math.floor(Date.now() / 1000) + expiresOffset,
  };
}

function makeUseCase() {
  const sessionRepo: jest.Mocked<OtpSessionRepositoryPort> = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const configService = {
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (key === 'OTP_HMAC_SECRET') return TEST_HMAC_SECRET;
      if (key === 'OTP_ENCRYPTION_KEY') return TEST_ENCRYPTION_KEY;
      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as any;
  const useCase = new VerifyOtpUseCase(
    mockLogger(),
    sessionRepo,
    configService,
  );
  return { useCase, sessionRepo };
}

describe('VerifyOtpUseCase', () => {
  it('lanza NotFoundException cuando la sesión no existe', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ sessionId: SESSION_ID, code: CORRECT_CODE }),
    ).rejects.toThrow(NotFoundException);
  });

  it('el error de sesión no encontrada tiene error=SESSION_NOT_FOUND', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ sessionId: SESSION_ID, code: CORRECT_CODE }),
    ).rejects.toMatchObject({ response: { error: 'SESSION_NOT_FOUND' } });
  });

  it('lanza BadRequestException cuando el código es incorrecto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(buildSession());
    await expect(
      useCase.execute({ sessionId: SESSION_ID, code: '000000' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('el error de código incorrecto tiene error=INVALID_CODE', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(buildSession());
    await expect(
      useCase.execute({ sessionId: SESSION_ID, code: '000000' }),
    ).rejects.toMatchObject({ response: { error: 'INVALID_CODE' } });
  });

  it('elimina la sesión cuando el código es incorrecto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(buildSession());
    try {
      await useCase.execute({ sessionId: SESSION_ID, code: '000000' });
    } catch {
      // expected
    }
    expect(sessionRepo.delete).toHaveBeenCalledWith(SESSION_ID);
  });

  it('retorna { ok: true, sessionId, customer } con código correcto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(buildSession());
    const result = await useCase.execute({
      sessionId: SESSION_ID,
      code: CORRECT_CODE,
    });
    expect(result).toEqual({
      ok: true,
      sessionId: SESSION_ID,
      customer: CUSTOMER,
    });
  });

  it('elimina la sesión en éxito (delete-on-use)', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(buildSession());
    await useCase.execute({ sessionId: SESSION_ID, code: CORRECT_CODE });
    expect(sessionRepo.delete).toHaveBeenCalledWith(SESSION_ID);
    expect(sessionRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('desencripta correctamente el customer en éxito', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(buildSession());
    const result = await useCase.execute({
      sessionId: SESSION_ID,
      code: CORRECT_CODE,
    });
    expect(result.customer).toEqual(CUSTOMER);
  });

  it('lanza BadRequestException con SESSION_CORRUPTED si customerEncrypted es inválido', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce({
      ...buildSession(),
      customerEncrypted: 'datos-corruptos-no-validos',
    });
    await expect(
      useCase.execute({ sessionId: SESSION_ID, code: CORRECT_CODE }),
    ).rejects.toMatchObject({ response: { error: 'SESSION_CORRUPTED' } });
  });

  it('elimina la sesión cuando customerEncrypted es inválido', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce({
      ...buildSession(),
      customerEncrypted: 'datos-corruptos',
    });
    try {
      await useCase.execute({ sessionId: SESSION_ID, code: CORRECT_CODE });
    } catch {
      // expected
    }
    expect(sessionRepo.delete).toHaveBeenCalledWith(SESSION_ID);
  });

  it('no llama delete cuando la sesión no existe', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(null);
    try {
      await useCase.execute({ sessionId: SESSION_ID, code: CORRECT_CODE });
    } catch {
      // expected
    }
    expect(sessionRepo.delete).not.toHaveBeenCalled();
  });
});
