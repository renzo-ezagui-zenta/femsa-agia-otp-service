import { SESClient } from '@aws-sdk/client-ses';
import { SesAdapter } from '../../../../../src/modules/otp/infrastructure/adapters/ses.adapter';
import type { NotificationPayload } from '../../../../../src/modules/otp/domain/ports/notification.port';
import { mockLogger } from '../../../../helpers/logger.mock';

// Mantiene SendEmailCommand real (para que .input esté disponible),
// sólo mockea SESClient.
jest.mock('@aws-sdk/client-ses', () => ({
  ...jest.requireActual('@aws-sdk/client-ses'),
  SESClient: jest.fn(),
}));

const PAYLOAD: NotificationPayload = {
  channel: 'mail',
  destination: 'ana@example.com',
  customerName: 'Ana García',
  otp: '123456',
};

function makeAdapter(ttlSeconds = 300) {
  const mockSend = jest.fn().mockResolvedValue({});
  (SESClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'OTP_TTL_SECONDS') return ttlSeconds;
      return 'us-east-1';
    }),
    getOrThrow: jest.fn().mockReturnValue('no-reply@antonia.fdsdevops.com'),
  } as any;

  const adapter = new SesAdapter(mockLogger(), configService);
  return { adapter, mockSend, configService };
}

describe('SesAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('llama a client.send una vez', async () => {
    const { adapter, mockSend } = makeAdapter();
    await adapter.send(PAYLOAD);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('usa la dirección from de la configuración', async () => {
    const { adapter, mockSend } = makeAdapter();
    await adapter.send(PAYLOAD);
    const command = mockSend.mock.calls[0][0];
    expect(command.input.Source).toBe('no-reply@antonia.fdsdevops.com');
  });

  it('envía al destino correcto', async () => {
    const { adapter, mockSend } = makeAdapter();
    await adapter.send(PAYLOAD);
    const command = mockSend.mock.calls[0][0];
    expect(command.input.Destination.ToAddresses).toEqual([
      PAYLOAD.destination,
    ]);
  });

  describe('body de texto plano', () => {
    it('incluye el OTP', async () => {
      const { adapter, mockSend } = makeAdapter();
      await adapter.send(PAYLOAD);
      const text = mockSend.mock.calls[0][0].input.Message.Body.Text
        .Data as string;
      expect(text).toContain(PAYLOAD.otp);
    });

    it('incluye el nombre del cliente', async () => {
      const { adapter, mockSend } = makeAdapter();
      await adapter.send(PAYLOAD);
      const text = mockSend.mock.calls[0][0].input.Message.Body.Text
        .Data as string;
      expect(text).toContain(PAYLOAD.customerName);
    });

    it('incluye el TTL en minutos (300s → 5 minutos)', async () => {
      const { adapter, mockSend } = makeAdapter(300);
      await adapter.send(PAYLOAD);
      const text = mockSend.mock.calls[0][0].input.Message.Body.Text
        .Data as string;
      expect(text).toContain('5 minutos');
    });

    it('usa singular cuando el TTL es 1 minuto (60s)', async () => {
      const { adapter, mockSend } = makeAdapter(60);
      await adapter.send(PAYLOAD);
      const text = mockSend.mock.calls[0][0].input.Message.Body.Text
        .Data as string;
      expect(text).toContain('1 minuto');
      expect(text).not.toContain('1 minutos');
    });
  });

  describe('body HTML', () => {
    it('incluye el OTP', async () => {
      const { adapter, mockSend } = makeAdapter();
      await adapter.send(PAYLOAD);
      const html = mockSend.mock.calls[0][0].input.Message.Body.Html
        .Data as string;
      expect(html).toContain(PAYLOAD.otp);
    });

    it('incluye el nombre del cliente', async () => {
      const { adapter, mockSend } = makeAdapter();
      await adapter.send(PAYLOAD);
      const html = mockSend.mock.calls[0][0].input.Message.Body.Html
        .Data as string;
      expect(html).toContain(PAYLOAD.customerName);
    });

    it('incluye el TTL en minutos', async () => {
      const { adapter, mockSend } = makeAdapter(300);
      await adapter.send(PAYLOAD);
      const html = mockSend.mock.calls[0][0].input.Message.Body.Html
        .Data as string;
      expect(html).toContain('5 minutos');
    });
  });

  it('usa getOrThrow para SES_FROM_ADDRESS', () => {
    const { configService } = makeAdapter();
    expect(configService.getOrThrow).toHaveBeenCalledWith('SES_FROM_ADDRESS');
  });

  it('propaga errores del cliente AWS', async () => {
    const { adapter, mockSend } = makeAdapter();
    mockSend.mockRejectedValueOnce(new Error('SES throttled'));
    await expect(adapter.send(PAYLOAD)).rejects.toThrow('SES throttled');
  });
});
