import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
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

    const session = await this.sessionRepo.findById(dto.sessionId);

    if (!session) {
      this.logger.warn(
        { sessionId: dto.sessionId },
        'session not found or expired',
      );
      throw new NotFoundException({ error: 'SESSION_NOT_FOUND' });
    }

    const hmacSecret = this.config.getOrThrow<string>('OTP_HMAC_SECRET');
    const encryptionKey = this.config.getOrThrow<string>('OTP_ENCRYPTION_KEY');
    const incomingHash = computeHmac(dto.code, hmacSecret);

    if (incomingHash !== session.otpHash) {
      this.logger.warn(
        { sessionId: dto.sessionId },
        'invalid OTP code — deleting session',
      );
      await this.sessionRepo.delete(dto.sessionId);
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
        'failed to decrypt customer data — deleting session',
      );
      await this.sessionRepo.delete(dto.sessionId);
      throw new BadRequestException({ error: 'SESSION_CORRUPTED' });
    }

    await this.sessionRepo.delete(dto.sessionId);

    this.logger.info(
      { sessionId: dto.sessionId, customerId: customer.id },
      'OTP verified successfully',
    );

    return { ok: true, sessionId: dto.sessionId, customer };
  }
}
