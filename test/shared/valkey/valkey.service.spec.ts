import Redis from 'ioredis';
import { ValkeyService } from '../../../src/shared/valkey/valkey.service';
import { mockLogger } from '../../helpers/logger.mock';

jest.mock('ioredis');

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

function makeService() {
  const mockGet = jest.fn();
  const mockSet = jest.fn().mockResolvedValue('OK');
  const mockDel = jest.fn().mockResolvedValue(1);
  const mockQuit = jest.fn().mockResolvedValue('OK');
  const mockPing = jest.fn().mockResolvedValue('PONG');
  const mockOn = jest.fn();

  MockRedis.mockImplementation(
    () =>
      ({
        get: mockGet,
        set: mockSet,
        del: mockDel,
        quit: mockQuit,
        ping: mockPing,
        on: mockOn,
      }) as any,
  );

  const configService = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  } as any;

  const service = new ValkeyService(mockLogger(), configService);
  service.onModuleInit();

  return {
    service,
    mockGet,
    mockSet,
    mockDel,
    mockQuit,
    mockPing,
    mockOn,
    configService,
  };
}

describe('ValkeyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit()', () => {
    it('crea el cliente Redis con la URL de configuración', () => {
      makeService();
      expect(MockRedis).toHaveBeenCalledWith('redis://localhost:6379');
    });

    it('registra handlers de eventos connect y error', () => {
      const { mockOn } = makeService();
      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('get()', () => {
    it('llama a client.get con la clave correcta', async () => {
      const { service, mockGet } = makeService();
      mockGet.mockResolvedValueOnce('valor');
      const result = await service.get('mi-clave');
      expect(mockGet).toHaveBeenCalledWith('mi-clave');
      expect(result).toBe('valor');
    });

    it('retorna null cuando la clave no existe', async () => {
      const { service, mockGet } = makeService();
      mockGet.mockResolvedValueOnce(null);
      const result = await service.get('no-existe');
      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('llama a client.set con clave, valor, EX y TTL', async () => {
      const { service, mockSet } = makeService();
      await service.set('mi-clave', 'mi-valor', 300);
      expect(mockSet).toHaveBeenCalledWith('mi-clave', 'mi-valor', 'EX', 300);
    });
  });

  describe('del()', () => {
    it('llama a client.del con la clave correcta', async () => {
      const { service, mockDel } = makeService();
      await service.del('mi-clave');
      expect(mockDel).toHaveBeenCalledWith('mi-clave');
    });
  });

  describe('ping()', () => {
    it('llama a client.ping', async () => {
      const { service, mockPing } = makeService();
      await service.ping();
      expect(mockPing).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy()', () => {
    it('llama a client.quit', async () => {
      const { service, mockQuit } = makeService();
      await service.onModuleDestroy();
      expect(mockQuit).toHaveBeenCalledTimes(1);
    });
  });
});
