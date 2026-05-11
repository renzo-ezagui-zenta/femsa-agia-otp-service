import { NotificationService } from '../../../../../src/modules/otp/infrastructure/adapters/notification.service';
import type { SesAdapter } from '../../../../../src/modules/otp/infrastructure/adapters/ses.adapter';
import type { EndUserMessagingAdapter } from '../../../../../src/modules/otp/infrastructure/adapters/end-user-messaging.adapter';
import type { NotificationPayload } from '../../../../../src/modules/otp/domain/ports/notification.port';
import { mockLogger } from '../../../../helpers/logger.mock';

const SMS_PAYLOAD: NotificationPayload = {
  channel: 'sms',
  destination: '+56912345678',
  customerName: 'Ana García',
  otp: '123456',
};

const MAIL_PAYLOAD: NotificationPayload = {
  channel: 'mail',
  destination: 'ana@example.com',
  customerName: 'Ana García',
  otp: '123456',
};

function makeService() {
  const ses = {
    send: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<SesAdapter>;
  const eum = {
    send: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EndUserMessagingAdapter>;
  const service = new NotificationService(mockLogger(), ses, eum);
  return { service, ses, eum };
}

describe('NotificationService', () => {
  it('delega a EndUserMessagingAdapter cuando channel=sms', async () => {
    const { service, eum, ses } = makeService();
    await service.send(SMS_PAYLOAD);
    expect(eum.send).toHaveBeenCalledWith(SMS_PAYLOAD);
    expect(ses.send).not.toHaveBeenCalled();
  });

  it('delega a SesAdapter cuando channel=mail', async () => {
    const { service, eum, ses } = makeService();
    await service.send(MAIL_PAYLOAD);
    expect(ses.send).toHaveBeenCalledWith(MAIL_PAYLOAD);
    expect(eum.send).not.toHaveBeenCalled();
  });

  it('propaga errores de EndUserMessagingAdapter', async () => {
    const { service, eum } = makeService();
    eum.send.mockRejectedValueOnce(new Error('EUM down'));
    await expect(service.send(SMS_PAYLOAD)).rejects.toThrow('EUM down');
  });

  it('propaga errores de SesAdapter', async () => {
    const { service, ses } = makeService();
    ses.send.mockRejectedValueOnce(new Error('SES down'));
    await expect(service.send(MAIL_PAYLOAD)).rejects.toThrow('SES down');
  });
});
