import { Module } from '@nestjs/common';
import { OtpController } from './infrastructure/http/otp.controller';
import { SendOtpUseCase } from './application/use-cases/send-otp.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { NotificationService } from './infrastructure/adapters/notification.service';
import { SesAdapter } from './infrastructure/adapters/ses.adapter';
import { EndUserMessagingAdapter } from './infrastructure/adapters/end-user-messaging.adapter';
import { DynamoDbOtpSessionAdapter } from './infrastructure/adapters/dynamodb-otp-session.adapter';
import { NOTIFICATION_PORT, OTP_SESSION_REPOSITORY_PORT } from './tokens';

@Module({
  controllers: [OtpController],
  providers: [
    SesAdapter,
    EndUserMessagingAdapter,
    SendOtpUseCase,
    VerifyOtpUseCase,
    { provide: NOTIFICATION_PORT, useClass: NotificationService },
    {
      provide: OTP_SESSION_REPOSITORY_PORT,
      useClass: DynamoDbOtpSessionAdapter,
    },
  ],
})
export class OtpModule {}
