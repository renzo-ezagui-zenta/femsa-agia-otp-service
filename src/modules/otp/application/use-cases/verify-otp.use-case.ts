import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OtpSessionRepositoryPort } from '../../domain/ports/otp-session-repository.port';
import { OTP_SESSION_REPOSITORY_PORT } from '../../tokens';
import type { VerifyOtpDto } from '../dto/verify-otp.schema';

export interface VerifyOtpResult {
  ok: true;
  sessionId: string;
}

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    @InjectPinoLogger(VerifyOtpUseCase.name)
    private readonly logger: PinoLogger,
    @Inject(OTP_SESSION_REPOSITORY_PORT)
    private readonly sessionRepo: OtpSessionRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: VerifyOtpDto): Promise<VerifyOtpResult> {
    this.logger.debug({ sessionId: dto.sessionId }, 'verify OTP requested');

    const session = await this.sessionRepo.findById(dto.sessionId);

    if (!session || session.verified) {
      this.logger.warn(
        {
          sessionId: dto.sessionId,
          reason: !session ? 'not_found' : 'already_verified',
        },
        'session not found or already verified',
      );
      throw new NotFoundException({ error: 'SESSION_NOT_FOUND' });
    }

    if (session.otp !== dto.code) {
      this.logger.warn(
        { sessionId: dto.sessionId },
        'invalid OTP code — deleting session',
      );
      await this.sessionRepo.delete(dto.sessionId);
      throw new BadRequestException({ error: 'INVALID_CODE' });
    }

    const ttl = this.config.get<number>('OTP_TTL_SECONDS', 300);
    await this.sessionRepo.markVerified(dto.sessionId, ttl);

    this.logger.info({ sessionId: dto.sessionId }, 'OTP verified successfully');

    return { ok: true, sessionId: dto.sessionId };
  }
}
