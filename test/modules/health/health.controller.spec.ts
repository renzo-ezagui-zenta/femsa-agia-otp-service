import type { HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { HealthController } from '../../../src/modules/health/health.controller';
import type { DynamoDbHealthIndicator } from '../../../src/modules/health/indicators/dynamodb.health-indicator';

const HEALTHY_RESULT: HealthCheckResult = {
  status: 'ok',
  info: { dynamodb: { status: 'up' } },
  error: {},
  details: { dynamodb: { status: 'up' } },
};

function makeController() {
  const mockDynamoDbIndicator = {
    isHealthy: jest.fn(),
  } as unknown as jest.Mocked<DynamoDbHealthIndicator>;

  const mockHealth = {
    check: jest.fn().mockResolvedValue(HEALTHY_RESULT),
  } as unknown as jest.Mocked<HealthCheckService>;

  const controller = new HealthController(mockHealth, mockDynamoDbIndicator);
  return { controller, mockHealth, mockDynamoDbIndicator };
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
