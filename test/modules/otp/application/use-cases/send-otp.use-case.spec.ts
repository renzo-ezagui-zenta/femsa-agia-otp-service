import { SendOtpUseCase } from '../../../../../src/modules/otp/application/use-cases/send-otp.use-case';
import type { NotificationPort } from '../../../../../src/modules/otp/domain/ports/notification.port';
import type { OtpSessionRepositoryPort } from '../../../../../src/modules/otp/domain/ports/otp-session-repository.port';
import { mockLogger } from '../../../../helpers/logger.mock';

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
    markVerified: jest.fn(),
  };
  const configService = { get: jest.fn().mockReturnValue(ttl) } as any;

  const useCase = new SendOtpUseCase(
    mockLogger(),
    notificationPort,
    sessionRepo,
    configService,
  );
  return { useCase, notificationPort, sessionRepo, configService };
}

describe('SendOtpUseCase', () => {
  it('guarda la sesión en el repositorio', async () => {
    const { useCase, sessionRepo } = makeUseCase();
    await useCase.execute({ customer: CUSTOMER, requestedVia: 'id' });
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
    const [sessionId, data, ttl] = sessionRepo.save.mock.calls[0];
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(data.customer).toEqual(CUSTOMER);
    expect(data.verified).toBe(false);
    expect(ttl).toBe(300);
  });

  it('usa el TTL de ConfigService', async () => {
    const { useCase, sessionRepo } = makeUseCase(600);
    await useCase.execute({ customer: CUSTOMER, requestedVia: 'id' });
    const [, , ttl] = sessionRepo.save.mock.calls[0];
    expect(ttl).toBe(600);
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
    // expiresAt debe ser ISO 8601 parseable
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
    sessionRepo.save.mockRejectedValueOnce(new Error('Valkey down'));
    await expect(
      useCase.execute({ customer: CUSTOMER, requestedVia: 'id' }),
    ).rejects.toThrow('Valkey down');
  });

  it('propaga errores de la notificación', async () => {
    const { useCase, notificationPort } = makeUseCase();
    notificationPort.send.mockRejectedValueOnce(new Error('SES error'));
    await expect(
      useCase.execute({ customer: CUSTOMER, requestedVia: 'id' }),
    ).rejects.toThrow('SES error');
  });
});
