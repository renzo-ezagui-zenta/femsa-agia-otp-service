import { Injectable, Inject } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  OtpSession,
  formatOtpCode,
} from '../../domain/entities/otp-session.entity';
import type { NotificationPort } from '../../domain/ports/notification.port';
import type { OtpSessionRepositoryPort } from '../../domain/ports/otp-session-repository.port';
import { NOTIFICATION_PORT, OTP_SESSION_REPOSITORY_PORT } from '../../tokens';
import type { SendOtpDto } from '../dto/send-otp.schema';
import { computeHmac, encrypt } from '../../../../shared/crypto/otp-crypto';

export interface SendOtpResult {
  sessionId: string;
  expiresAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    mail: string;
  };
  sentTo: {
    channel: 'sms' | 'mail';
    value: string;
  };
}

@Injectable()
export class SendOtpUseCase {
  constructor(
    @InjectPinoLogger(SendOtpUseCase.name) private readonly logger: PinoLogger,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
    @Inject(OTP_SESSION_REPOSITORY_PORT)
    private readonly sessionRepo: OtpSessionRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: SendOtpDto): Promise<SendOtpResult> {
    this.logger.debug(
      { customerId: dto.customer.id, requestedVia: dto.requestedVia },
      'send OTP requested',
    );

    const ttl = this.config.get<number>('OTP_TTL_SECONDS', 300);
    const hmacSecret = this.config.getOrThrow<string>('OTP_HMAC_SECRET');
    const encryptionKey = this.config.getOrThrow<string>('OTP_ENCRYPTION_KEY');

    const otp = formatOtpCode(randomInt(0, 1_000_000));
    const session = OtpSession.create(dto.customer, dto.requestedVia, ttl, otp);

    this.logger.debug(
      {
        sessionId: session.sessionId,
        deliveryChannel: session.deliveryChannel,
        ttl,
      },
      'OTP session created',
    );

    const otpHash = computeHmac(otp, hmacSecret);
    const customerEncrypted = encrypt(
      JSON.stringify(session.customer),
      encryptionKey,
    );

    await this.sessionRepo.save(session.sessionId, {
      otpHash,
      customerEncrypted,
      expiresAt: session.expiresAtEpoch,
    });

    this.logger.debug({ sessionId: session.sessionId }, 'session persisted');

    const destination =
      session.deliveryChannel === 'sms'
        ? session.customer.phone
        : session.customer.mail;

    await this.notification.send({
      channel: session.deliveryChannel,
      destination,
      customerName: session.customer.name,
      otp: session.otp,
    });

    this.logger.info(
      {
        sessionId: session.sessionId,
        channel: session.deliveryChannel,
        customerId: dto.customer.id,
      },
      'OTP sent successfully',
    );

    return {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt.toISOString(),
      customer: session.customer,
      sentTo: {
        channel: session.deliveryChannel,
        value: destination,
      },
    };
  }
}
