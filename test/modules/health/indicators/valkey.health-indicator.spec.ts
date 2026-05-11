import { HealthCheckError } from '@nestjs/terminus';
import { ValkeyHealthIndicator } from '../../../../src/modules/health/indicators/valkey.health-indicator';
import type { ValkeyService } from '../../../../src/shared/valkey/valkey.service';

function makeIndicator() {
  const mockValkey = {
    ping: jest.fn(),
  } as unknown as jest.Mocked<ValkeyService>;

  const indicator = new ValkeyHealthIndicator(mockValkey);
  return { indicator, mockValkey };
}

describe('ValkeyHealthIndicator', () => {
  describe('isHealthy()', () => {
    it('retorna status up cuando Valkey responde', async () => {
      const { indicator, mockValkey } = makeIndicator();
      mockValkey.ping.mockResolvedValue(undefined);
      const result = await indicator.isHealthy('valkey');
      expect(result).toEqual({ valkey: { status: 'up' } });
    });

    it('lanza HealthCheckError cuando Valkey no responde', async () => {
      const { indicator, mockValkey } = makeIndicator();
      mockValkey.ping.mockRejectedValue(new Error('connection refused'));
      await expect(indicator.isHealthy('valkey')).rejects.toBeInstanceOf(
        HealthCheckError,
      );
    });

    it('HealthCheckError contiene status down con el mensaje de error', async () => {
      const { indicator, mockValkey } = makeIndicator();
      mockValkey.ping.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(indicator.isHealthy('valkey')).rejects.toMatchObject({
        causes: { valkey: { status: 'down', message: 'ECONNREFUSED' } },
      });
    });
  });
});
