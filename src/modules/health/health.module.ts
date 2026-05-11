import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ValkeyModule } from '../../shared/valkey/valkey.module';
import { HealthController } from './health.controller';
import { ValkeyHealthIndicator } from './indicators/valkey.health-indicator';

@Module({
  imports: [TerminusModule, ValkeyModule],
  controllers: [HealthController],
  providers: [ValkeyHealthIndicator],
})
export class HealthModule {}
