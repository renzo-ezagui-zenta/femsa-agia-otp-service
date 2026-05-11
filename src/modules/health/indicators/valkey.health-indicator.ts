import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ValkeyService } from '../../../shared/valkey/valkey.service';

@Injectable()
export class ValkeyHealthIndicator extends HealthIndicator {
  constructor(private readonly valkey: ValkeyService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.valkey.ping();
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'Valkey ping failed',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
