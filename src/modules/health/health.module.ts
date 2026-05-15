import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DynamoDbHealthIndicator } from './indicators/dynamodb.health-indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DynamoDbHealthIndicator],
})
export class HealthModule {}
