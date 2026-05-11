import { PinoLogger } from 'nestjs-pino';

/**
 * Retorna un jest.Mocked<PinoLogger> listo para pasar como primer
 * argumento a cualquier clase que use @InjectPinoLogger.
 *
 * Cubre todos los métodos de logging de pino más `assign`.
 * Los tests que no quieran verificar logs pueden ignorarlo;
 * los que sí quieran pueden hacer `expect(logger.warn).toHaveBeenCalled()`.
 */
export function mockLogger(): jest.Mocked<PinoLogger> {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    assign: jest.fn(),
    logger: {} as any,
  } as unknown as jest.Mocked<PinoLogger>;
}
