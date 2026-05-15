import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DynamoDbHealthIndicator } from './indicators/dynamodb.health-indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dynamoDbIndicator: DynamoDbHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.dynamoDbIndicator.isHealthy('dynamodb'),
    ]);
  }
}
