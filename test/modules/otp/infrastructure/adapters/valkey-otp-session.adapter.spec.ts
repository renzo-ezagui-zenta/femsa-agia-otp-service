import { ValkeyOtpSessionAdapter } from '../../../../../src/modules/otp/infrastructure/adapters/valkey-otp-session.adapter';
import type { ValkeyService } from '../../../../../src/shared/valkey/valkey.service';
import type { OtpSessionData } from '../../../../../src/modules/otp/domain/entities/otp-session.entity';
import { mockLogger } from '../../../../helpers/logger.mock';

const SESSION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const SESSION_KEY = `otp:session:${SESSION_ID}`;

const SESSION_DATA: OtpSessionData = {
  customer: {
    id: 'c1',
    name: 'Ana',
    phone: '+56912345678',
    mail: 'ana@example.com',
  },
  requestedVia: 'id',
  deliveryChannel: 'sms',
  otp: '123456',
  verified: false,
};

function makeAdapter() {
  const valkey = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ValkeyService>;
  const adapter = new ValkeyOtpSessionAdapter(mockLogger(), valkey);
  return { adapter, valkey };
}

describe('ValkeyOtpSessionAdapter', () => {
  describe('save()', () => {
    it('llama a valkey.set con la key correcta', async () => {
      const { adapter, valkey } = makeAdapter();
      await adapter.save(SESSION_ID, SESSION_DATA, 300);
      expect(valkey.set).toHaveBeenCalledWith(
        SESSION_KEY,
        expect.any(String),
        300,
      );
    });

    it('serializa los datos como JSON', async () => {
      const { adapter, valkey } = makeAdapter();
      await adapter.save(SESSION_ID, SESSION_DATA, 300);
      const [, json] = valkey.set.mock.calls[0];
      expect(JSON.parse(json)).toEqual(SESSION_DATA);
    });
  });

  describe('findById()', () => {
    it('retorna los datos deserializados cuando la clave existe', async () => {
      const { adapter, valkey } = makeAdapter();
      valkey.get.mockResolvedValueOnce(JSON.stringify(SESSION_DATA));
      const result = await adapter.findById(SESSION_ID);
      expect(result).toEqual(SESSION_DATA);
    });

    it('llama a valkey.get con la key correcta', async () => {
      const { adapter, valkey } = makeAdapter();
      valkey.get.mockResolvedValueOnce(JSON.stringify(SESSION_DATA));
      await adapter.findById(SESSION_ID);
      expect(valkey.get).toHaveBeenCalledWith(SESSION_KEY);
    });

    it('retorna null cuando la clave no existe', async () => {
      const { adapter, valkey } = makeAdapter();
      valkey.get.mockResolvedValueOnce(null);
      const result = await adapter.findById(SESSION_ID);
      expect(result).toBeNull();
    });
  });

  describe('delete()', () => {
    it('llama a valkey.del con la key correcta', async () => {
      const { adapter, valkey } = makeAdapter();
      await adapter.delete(SESSION_ID);
      expect(valkey.del).toHaveBeenCalledWith(SESSION_KEY);
    });
  });

  describe('markVerified()', () => {
    it('lee la sesión, setea verified=true y la guarda', async () => {
      const { adapter, valkey } = makeAdapter();
      valkey.get.mockResolvedValueOnce(JSON.stringify(SESSION_DATA));
      await adapter.markVerified(SESSION_ID, 300);
      const [, json, ttl] = valkey.set.mock.calls[0];
      const saved = JSON.parse(json);
      expect(saved.verified).toBe(true);
      expect(ttl).toBe(300);
    });

    it('no llama a set si la sesión no existe', async () => {
      const { adapter, valkey } = makeAdapter();
      valkey.get.mockResolvedValueOnce(null);
      await adapter.markVerified(SESSION_ID, 300);
      expect(valkey.set).not.toHaveBeenCalled();
    });

    it('preserva los demás campos de la sesión al marcar verificada', async () => {
      const { adapter, valkey } = makeAdapter();
      valkey.get.mockResolvedValueOnce(JSON.stringify(SESSION_DATA));
      await adapter.markVerified(SESSION_ID, 300);
      const [, json] = valkey.set.mock.calls[0];
      const saved = JSON.parse(json);
      expect(saved.otp).toBe(SESSION_DATA.otp);
      expect(saved.customer).toEqual(SESSION_DATA.customer);
    });
  });
});
