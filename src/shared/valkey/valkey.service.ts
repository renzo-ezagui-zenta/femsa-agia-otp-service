import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';

@Injectable()
export class ValkeyService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(
    @InjectPinoLogger(ValkeyService.name) private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const url = this.config.get<string>('VALKEY_URL', 'redis://localhost:6379');
    this.logger.debug({ url }, 'connecting to Valkey');
    this.client = new Redis(url);
    this.client.on('connect', () => this.logger.info('connected to Valkey'));
    this.client.on('error', (err: Error) =>
      this.logger.error({ err }, 'Valkey error'),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.debug('disconnecting from Valkey');
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    this.logger.debug({ key }, 'GET');
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.logger.debug({ key, ttlSeconds }, 'SET');
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    this.logger.debug({ key }, 'DEL');
    await this.client.del(key);
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }
}
