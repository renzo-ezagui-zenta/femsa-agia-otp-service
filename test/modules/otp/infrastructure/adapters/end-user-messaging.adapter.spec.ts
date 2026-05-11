import { PinpointSMSVoiceV2Client } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { EndUserMessagingAdapter } from '../../../../../src/modules/otp/infrastructure/adapters/end-user-messaging.adapter';
import type { NotificationPayload } from '../../../../../src/modules/otp/domain/ports/notification.port';
import { mockLogger } from '../../../../helpers/logger.mock';

// Mantiene SendTextMessageCommand real (para que .input esté disponible),
// sólo mockea PinpointSMSVoiceV2Client.
jest.mock('@aws-sdk/client-pinpoint-sms-voice-v2', () => ({
  ...jest.requireActual('@aws-sdk/client-pinpoint-sms-voice-v2'),
  PinpointSMSVoiceV2Client: jest.fn(),
}));

const PAYLOAD: NotificationPayload = {
  channel: 'sms',
  destination: '+56912345678',
  customerName: 'Ana García',
  otp: '123456',
};

function makeRealAdapter() {
  const mockSend = jest.fn().mockResolvedValue({});
  (PinpointSMSVoiceV2Client as jest.Mock).mockImplementation(() => ({
    send: mockSend,
  }));

  const configService = {
    get: jest.fn((key: string, def?: any) => {
      if (key === 'EUM_MOCK') return 'false';
      if (key === 'AWS_REGION') return 'us-east-1';
      return def;
    }),
    getOrThrow: jest
      .fn()
      .mockReturnValue('arn:aws:sms-voice:us-east-1:000000:phone-number/xyz'),
  } as any;

  const adapter = new EndUserMessagingAdapter(mockLogger(), configService);
  return { adapter, mockSend, configService };
}

function makeMockAdapter() {
  const configService = {
    get: jest.fn((key: string, def?: any) => {
      if (key === 'EUM_MOCK') return 'true';
      return def;
    }),
    getOrThrow: jest.fn(),
  } as any;

  const adapter = new EndUserMessagingAdapter(mockLogger(), configService);
  return { adapter, configService };
}

describe('EndUserMessagingAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('modo mock (EUM_MOCK=true)', () => {
    it('no instancia PinpointSMSVoiceV2Client', () => {
      makeMockAdapter();
      expect(PinpointSMSVoiceV2Client).not.toHaveBeenCalled();
    });

    it('no llama a getOrThrow (no requiere EUM_ORIGINATION_IDENTITY)', () => {
      const { configService } = makeMockAdapter();
      expect(configService.getOrThrow).not.toHaveBeenCalled();
    });

    it('imprime en consola en vez de llamar al cliente AWS', async () => {
      const { adapter } = makeMockAdapter();
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      await adapter.send(PAYLOAD);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('completa sin error', async () => {
      const { adapter } = makeMockAdapter();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      await expect(adapter.send(PAYLOAD)).resolves.toBeUndefined();
      jest.restoreAllMocks();
    });
  });

  describe('modo real (EUM_MOCK=false)', () => {
    it('llama a client.send una vez', async () => {
      const { adapter, mockSend } = makeRealAdapter();
      await adapter.send(PAYLOAD);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('envía al número de destino correcto', async () => {
      const { adapter, mockSend } = makeRealAdapter();
      await adapter.send(PAYLOAD);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.DestinationPhoneNumber).toBe(PAYLOAD.destination);
    });

    it('incluye el OTP en el mensaje', async () => {
      const { adapter, mockSend } = makeRealAdapter();
      await adapter.send(PAYLOAD);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageBody).toContain(PAYLOAD.otp);
    });

    it('incluye el nombre del cliente en el mensaje', async () => {
      const { adapter, mockSend } = makeRealAdapter();
      await adapter.send(PAYLOAD);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageBody).toContain(PAYLOAD.customerName);
    });

    it('usa la origination identity de la configuración', async () => {
      const { adapter, mockSend, configService } = makeRealAdapter();
      await adapter.send(PAYLOAD);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.OriginationIdentity).toBe(
        configService.getOrThrow.mock.results[0].value,
      );
    });

    it('propaga errores del cliente AWS', async () => {
      const { adapter, mockSend } = makeRealAdapter();
      mockSend.mockRejectedValueOnce(new Error('EUM throttled'));
      await expect(adapter.send(PAYLOAD)).rejects.toThrow('EUM throttled');
    });
  });
});
