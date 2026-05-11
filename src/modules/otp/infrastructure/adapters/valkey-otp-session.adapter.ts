import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OtpSessionData } from '../../domain/entities/otp-session.entity';
import type { OtpSessionRepositoryPort } from '../../domain/ports/otp-session-repository.port';
import { ValkeyService } from '../../../../shared/valkey/valkey.service';

const SESSION_PREFIX = 'otp:session:';

@Injectable()
export class ValkeyOtpSessionAdapter implements OtpSessionRepositoryPort {
  constructor(
    @InjectPinoLogger(ValkeyOtpSessionAdapter.name)
    private readonly logger: PinoLogger,
    private readonly valkey: ValkeyService,
  ) {}

  async save(
    sessionId: string,
    data: OtpSessionData,
    ttlSeconds: number,
  ): Promise<void> {
    this.logger.debug({ sessionId, ttlSeconds }, 'saving OTP session');
    await this.valkey.set(
      SESSION_PREFIX + sessionId,
      JSON.stringify(data),
      ttlSeconds,
    );
    this.logger.debug({ sessionId }, 'OTP session saved');
  }

  async findById(sessionId: string): Promise<OtpSessionData | null> {
    this.logger.debug({ sessionId }, 'looking up OTP session');
    const raw = await this.valkey.get(SESSION_PREFIX + sessionId);
    if (!raw) {
      this.logger.debug({ sessionId }, 'OTP session not found');
      return null;
    }
    this.logger.debug({ sessionId }, 'OTP session found');
    return JSON.parse(raw) as OtpSessionData;
  }

  async delete(sessionId: string): Promise<void> {
    this.logger.debug({ sessionId }, 'deleting OTP session');
    await this.valkey.del(SESSION_PREFIX + sessionId);
    this.logger.debug({ sessionId }, 'OTP session deleted');
  }

  async markVerified(sessionId: string, ttlSeconds: number): Promise<void> {
    this.logger.debug({ sessionId }, 'marking OTP session as verified');
    const session = await this.findById(sessionId);
    if (!session) {
      this.logger.warn(
        { sessionId },
        'markVerified: session not found, skipping',
      );
      return;
    }
    await this.save(sessionId, { ...session, verified: true }, ttlSeconds);
    this.logger.info({ sessionId }, 'OTP session marked as verified');
  }
}
