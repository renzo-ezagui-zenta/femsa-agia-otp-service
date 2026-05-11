import { Module } from '@nestjs/common';
import { OtpController } from './infrastructure/http/otp.controller';
import { SendOtpUseCase } from './application/use-cases/send-otp.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { NotificationService } from './infrastructure/adapters/notification.service';
import { SesAdapter } from './infrastructure/adapters/ses.adapter';
import { EndUserMessagingAdapter } from './infrastructure/adapters/end-user-messaging.adapter';
import { ValkeyOtpSessionAdapter } from './infrastructure/adapters/valkey-otp-session.adapter';
import { ValkeyModule } from '../../shared/valkey/valkey.module';
import { NOTIFICATION_PORT, OTP_SESSION_REPOSITORY_PORT } from './tokens';

@Module({
  imports: [ValkeyModule],
  controllers: [OtpController],
  providers: [
    SesAdapter,
    EndUserMessagingAdapter,
    SendOtpUseCase,
    VerifyOtpUseCase,
    { provide: NOTIFICATION_PORT, useClass: NotificationService },
    { provide: OTP_SESSION_REPOSITORY_PORT, useClass: ValkeyOtpSessionAdapter },
  ],
})
export class OtpModule {}
