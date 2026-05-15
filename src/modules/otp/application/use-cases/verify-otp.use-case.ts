import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OtpSessionRepositoryPort } from '../../domain/ports/otp-session-repository.port';
import type { Customer } from '../../domain/entities/otp-session.entity';
import { OTP_SESSION_REPOSITORY_PORT } from '../../tokens';
import type { VerifyOtpDto } from '../dto/verify-otp.schema';
import { computeHmac, decrypt } from '../../../../shared/crypto/otp-crypto';

export interface VerifyOtpResult {
  ok: true;
  sessionId: string;
  customer: Customer;
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

    // Atomically delete and retrieve — only one concurrent caller can win
    const result = await this.sessionRepo.consumeById(dto.sessionId);

    if (result.status === 'not_found') {
      this.logger.warn(
        { sessionId: dto.sessionId },
        'session not found or already consumed',
      );
      throw new NotFoundException({ error: 'SESSION_NOT_FOUND' });
    }

    if (result.status === 'expired') {
      this.logger.warn({ sessionId: dto.sessionId }, 'session expired');
      throw new GoneException({ error: 'SESSION_EXPIRED' });
    }

    const session = result.data;
    const hmacSecret = this.config.getOrThrow<string>('OTP_HMAC_SECRET');
    const encryptionKey = this.config.getOrThrow<string>('OTP_ENCRYPTION_KEY');
    const incomingHash = computeHmac(dto.code, hmacSecret);

    if (incomingHash !== session.otpHash) {
      // Session is already deleted by consumeById — no extra delete needed
      this.logger.warn({ sessionId: dto.sessionId }, 'invalid OTP code');
      throw new BadRequestException({ error: 'INVALID_CODE' });
    }

    let customer: Customer;
    try {
      customer = JSON.parse(
        decrypt(session.customerEncrypted, encryptionKey),
      ) as Customer;
    } catch {
      this.logger.error(
        { sessionId: dto.sessionId },
        'failed to decrypt customer data',
      );
      throw new BadRequestException({ error: 'SESSION_CORRUPTED' });
    }

    this.logger.info(
      { sessionId: dto.sessionId, customerId: customer.id },
      'OTP verified successfully',
    );

    return { ok: true, sessionId: dto.sessionId, customer };
  }
}
