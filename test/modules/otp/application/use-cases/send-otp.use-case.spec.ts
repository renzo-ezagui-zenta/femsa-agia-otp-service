import { SendOtpUseCase } from '../../../../../src/modules/otp/application/use-cases/send-otp.use-case';
import type { NotificationPort } from '../../../../../src/modules/otp/domain/ports/notification.port';
import type { OtpSessionRepositoryPort } from '../../../../../src/modules/otp/domain/ports/otp-session-repository.port';
import { computeHmac } from '../../../../../src/shared/crypto/otp-crypto';
import { mockLogger } from '../../../../helpers/logger.mock';

const TEST_HMAC_SECRET = 'test-hmac-secret-that-is-at-least-32-chars!!';
const TEST_ENCRYPTION_KEY = '00'.repeat(32); // 64 hex chars = 32 bytes AES-256

const CUSTOMER = {
  id: 'cust-1',
  name: 'Ana García',
  phone: '+56912345678',
  mail: 'ana@example.com',
};

function makeUseCase(ttl = 300) {
  const notificationPort: jest.Mocked<NotificationPort> = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  const sessionRepo: jest.Mocked<OtpSessionRepositoryPort> = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    delete: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockImplementation((key: string, defaultVal?: unknown) => {
      if (key === 'OTP_TTL_SECONDS') return ttl;
      return defaultVal;
    }),
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (key === 'OTP_HMAC_SECRET') return TEST_HMAC_SECRET;
      if (key === 'OTP_ENCRYPTION_KEY') return TEST_ENCRYPTION_KEY;
      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as any;

  const useCase = new SendOtpUseCase(
    mockLogger(),
    notificationPort,
    sessionRepo,
    configService,
  );
  return { useCase, notificationPort, sessionRepo, configService };
}

describe('SendOtpUseCase', () => {
  it('guarda la sesión en el repositorio con shape correcto', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    await useCase.execute({ customer: CUSTOMER, requestedVia: 'id' });
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
    const [sessionId, data] = sessionRepo.save.mock.calls[0];
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    // otpHash es un hex de 64 chars (SHA-256)
    expect(data.otpHash).toMatch(/^[0-9a-f]{64}$/);
    // customerEncrypted sigue el formato iv:authTag:ciphertext
    expect(data.customerEncrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    // expiresAt es epoch en segundos
    expect(typeof data.expiresAt).toBe('number');
    expect(data.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('el otpHash almacenado coincide con HMAC del OTP enviado', async () => {
    const { useCase, sessionRepo, notificationPort } = makeUseCase();
    await useCase.execute({ customer: CUSTOMER, requestedVia: 'id' });
    const [, data] = sessionRepo.save.mock.calls[0];
    const sentOtp = notificationPort.send.mock.calls[0][0].otp;
    expect(data.otpHash).toBe(computeHmac(sentOtp, TEST_HMAC_SECRET));
  });

  it('no persiste PII del customer en claro', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    await useCase.execute({ customer: CUSTOMER, requestedVia: 'id' });
    const [, data] = sessionRepo.save.mock.calls[0];
    const raw = JSON.stringify(data);
    expect(raw).not.toContain(CUSTOMER.mail);
    expect(raw).not.toContain(CUSTOMER.phone);
    expect(raw).not.toContain(CUSTOMER.name);
  });

  it('usa el TTL de ConfigService para calcular expiresAt', async () => {
    const { useCase, sessionRepo } = makeUseCase(600);
    const before = Math.floor(Date.now() / 1000);
    await useCase.execute({ customer: CUSTOMER, requestedVia: 'id' });
    const [, data] = sessionRepo.save.mock.calls[0];
    expect(data.expiresAt).toBeGreaterThanOrEqual(before + 600);
    expect(data.expiresAt).toBeLessThanOrEqual(before + 601);
  });

  it('envía la notificación con los parámetros correctos (canal sms → phone)', async () => {
    const { useCase, notificationPort } = makeUseCase();
    await useCase.execute({ customer: CUSTOMER, requestedVia: 'id' });
    expect(notificationPort.send).toHaveBeenCalledTimes(1);
    const payload = notificationPort.send.mock.calls[0][0];
    expect(payload.channel).toBe('sms');
    expect(payload.destination).toBe(CUSTOMER.phone);
    expect(payload.customerName).toBe(CUSTOMER.name);
    expect(payload.otp).toMatch(/^\d{6}$/);
  });

  it('envía la notificación vía mail cuando requestedVia=phone', async () => {
    const { useCase, notificationPort } = makeUseCase();
    await useCase.execute({ customer: CUSTOMER, requestedVia: 'phone' });
    const payload = notificationPort.send.mock.calls[0][0];
    expect(payload.channel).toBe('mail');
    expect(payload.destination).toBe(CUSTOMER.mail);
  });

  it('retorna el shape correcto de SendOtpResult', async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      customer: CUSTOMER,
      requestedVia: 'id',
    });
    expect(result).toMatchObject({
      sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      expiresAt: expect.any(String),
      customer: CUSTOMER,
      sentTo: {
        channel: 'sms',
        value: CUSTOMER.phone,
      },
    });
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('sentTo.value es el email cuando el canal es mail', async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      customer: CUSTOMER,
      requestedVia: 'phone',
    });
    expect(result.sentTo).toEqual({ channel: 'mail', value: CUSTOMER.mail });
  });

  it('propaga errores del repositorio', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    sessionRepo.save.mockRejectedValueOnce(new Error('DynamoDB down'));
    await expect(
      useCase.execute({ customer: CUSTOMER, requestedVia: 'id' }),
    ).rejects.toThrow('DynamoDB down');
  });

  it('propaga errores de la notificación', async () => {
    const { useCase, notificationPort } = makeUseCase();
    notificationPort.send.mockRejectedValueOnce(new Error('SES error'));
    await expect(
      useCase.execute({ customer: CUSTOMER, requestedVia: 'id' }),
    ).rejects.toThrow('SES error');
  });
});
