import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VerifyOtpUseCase } from '../../../../../src/modules/otp/application/use-cases/verify-otp.use-case';
import type { OtpSessionRepositoryPort } from '../../../../../src/modules/otp/domain/ports/otp-session-repository.port';
import { mockLogger } from '../../../../helpers/logger.mock';

const SESSION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

const BASE_SESSION = {
  customer: {
    id: 'c1',
    name: 'Ana',
    phone: '+56912345678',
    mail: 'ana@example.com',
  },
  requestedVia: 'id' as const,
  deliveryChannel: 'sms' as const,
  otp: '123456',
  verified: false,
};

function makeUseCase(ttl = 300) {
  const sessionRepo: jest.Mocked<OtpSessionRepositoryPort> = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    markVerified: jest.fn().mockResolvedValue(undefined),
  };
  const configService = { get: jest.fn().mockReturnValue(ttl) } as any;
  const useCase = new VerifyOtpUseCase(
    mockLogger(),
    sessionRepo,
    configService,
  );
  return { useCase, sessionRepo, configService };
}

describe('VerifyOtpUseCase', () => {
  it('lanza NotFoundException cuando la sesión no existe', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ sessionId: SESSION_ID, code: '123456' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('el error de sesión no encontrada tiene error=SESSION_NOT_FOUND', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(null);
    try {
      await useCase.execute({ sessionId: SESSION_ID, code: '123456' });
    } catch (e: any) {
      expect(e.response).toEqual({ error: 'SESSION_NOT_FOUND' });
    }
  });

  it('lanza NotFoundException cuando la sesión ya está verificada', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce({
      ...BASE_SESSION,
      verified: true,
    });
    await expect(
      useCase.execute({ sessionId: SESSION_ID, code: '123456' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('sesión verificada no llama delete ni markVerified', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce({
      ...BASE_SESSION,
      verified: true,
    });
    try {
      await useCase.execute({ sessionId: SESSION_ID, code: '123456' });
    } catch {
      // expected
    }
    expect(sessionRepo.delete).not.toHaveBeenCalled();
    expect(sessionRepo.markVerified).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException cuando el código es incorrecto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(BASE_SESSION);
    await expect(
      useCase.execute({ sessionId: SESSION_ID, code: '000000' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('el error de código incorrecto tiene error=INVALID_CODE', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(BASE_SESSION);
    try {
      await useCase.execute({ sessionId: SESSION_ID, code: '000000' });
    } catch (e: any) {
      expect(e.response).toEqual({ error: 'INVALID_CODE' });
    }
  });

  it('elimina la sesión cuando el código es incorrecto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(BASE_SESSION);
    try {
      await useCase.execute({ sessionId: SESSION_ID, code: '000000' });
    } catch {
      // expected
    }
    expect(sessionRepo.delete).toHaveBeenCalledWith(SESSION_ID);
  });

  it('no llama markVerified cuando el código es incorrecto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(BASE_SESSION);
    try {
      await useCase.execute({ sessionId: SESSION_ID, code: '000000' });
    } catch {
      // expected
    }
    expect(sessionRepo.markVerified).not.toHaveBeenCalled();
  });

  it('retorna { ok: true, sessionId } con código correcto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(BASE_SESSION);
    const result = await useCase.execute({
      sessionId: SESSION_ID,
      code: '123456',
    });
    expect(result).toEqual({ ok: true, sessionId: SESSION_ID });
  });

  it('llama markVerified con el TTL de ConfigService', async () => {
    const { useCase, sessionRepo } = makeUseCase(600);
    sessionRepo.findById.mockResolvedValueOnce(BASE_SESSION);
    await useCase.execute({ sessionId: SESSION_ID, code: '123456' });
    expect(sessionRepo.markVerified).toHaveBeenCalledWith(SESSION_ID, 600);
  });

  it('no llama delete cuando el código es correcto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.findById.mockResolvedValueOnce(BASE_SESSION);
    await useCase.execute({ sessionId: SESSION_ID, code: '123456' });
    expect(sessionRepo.delete).not.toHaveBeenCalled();
  });
});
