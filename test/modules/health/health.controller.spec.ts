import type { HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { HealthController } from '../../../src/modules/health/health.controller';
import type { ValkeyHealthIndicator } from '../../../src/modules/health/indicators/valkey.health-indicator';

const HEALTHY_RESULT: HealthCheckResult = {
  status: 'ok',
  info: { valkey: { status: 'up' } },
  error: {},
  details: { valkey: { status: 'up' } },
};

function makeController() {
  const mockValkeyIndicator = {
    isHealthy: jest.fn(),
  } as unknown as jest.Mocked<ValkeyHealthIndicator>;

  const mockHealth = {
    check: jest.fn().mockResolvedValue(HEALTHY_RESULT),
  } as unknown as jest.Mocked<HealthCheckService>;

  const controller = new HealthController(mockHealth, mockValkeyIndicator);
  return { controller, mockHealth, mockValkeyIndicator };
}

describe('HealthController', () => {
  describe('check()', () => {
    it('llama a health.check con un indicador', async () => {
      const { controller, mockHealth } = makeController();
      await controller.check();
      expect(mockHealth.check).toHaveBeenCalledWith([expect.any(Function)]);
    });

    it('retorna el resultado de health.check', async () => {
      const { controller } = makeController();
      const result = await controller.check();
      expect(result).toEqual(HEALTHY_RESULT);
    });
  });
});
