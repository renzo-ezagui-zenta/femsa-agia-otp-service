import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { OtpModule } from './modules/otp/otp.module';
import { HealthModule } from './modules/health/health.module';
import { validateEnv } from './env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV') !== 'production';
        const logLevel =
          config.get<string>('LOG_LEVEL') ?? (isDev ? 'debug' : 'info');
        return {
          pinoHttp: {
            level: logLevel,

            // Propaga x-request-id del cliente o genera uno nuevo — útil para correlación en CloudWatch
            genReqId: (req: IncomingMessage) =>
              (req.headers['x-request-id'] as string | undefined) ??
              randomUUID(),

            // 4xx → warn, 5xx/error → error, resto → info
            customLogLevel: (
              _req: IncomingMessage,
              res: ServerResponse,
              err?: Error,
            ) => {
              if (err ?? res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },

            // En producción: JSON puro a stdout — CloudWatch lo ingiere nativamente
            // En dev: pino-pretty con colores, timestamp legible y una línea por log
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
          },
        };
      },
    }),
    OtpModule,
    HealthModule,
  ],
})
export class AppModule {}
