import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from '@aws-sdk/client-pinpoint-sms-voice-v2';
import type { NotificationPayload } from '../../domain/ports/notification.port';

const ELECTRIC_GREEN = '\x1b[92m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

@Injectable()
export class EndUserMessagingAdapter {
  private readonly client: PinpointSMSVoiceV2Client;
  private readonly originationIdentity: string;
  private readonly mockMode: boolean;

  constructor(
    @InjectPinoLogger(EndUserMessagingAdapter.name)
    private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {
    this.mockMode = this.config.get<string>('EUM_MOCK') === 'true';

    if (this.mockMode) {
      this.logger.warn(
        'EUM_MOCK=true — SMS will NOT be sent. OTP codes will be printed to console.',
      );
    } else {
      this.client = new PinpointSMSVoiceV2Client({
        region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      });
      this.originationIdentity = this.config.getOrThrow<string>(
        'EUM_ORIGINATION_IDENTITY',
      );
      this.logger.debug(
        { originationIdentity: this.originationIdentity },
        'EndUserMessagingAdapter initialized',
      );
    }
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (this.mockMode) {
      console.log(
        `\n${ELECTRIC_GREEN}${BOLD}┌─────────────────────────────────┐${RESET}`,
      );
      console.log(
        `${ELECTRIC_GREEN}${BOLD}│        📱 SMS MOCK              │${RESET}`,
      );
      console.log(
        `${ELECTRIC_GREEN}${BOLD}│  Para: ${payload.destination.padEnd(25)}│${RESET}`,
      );
      console.log(
        `${ELECTRIC_GREEN}${BOLD}│  OTP:  ${payload.otp.padEnd(25)}│${RESET}`,
      );
      console.log(
        `${ELECTRIC_GREEN}${BOLD}└─────────────────────────────────┘${RESET}\n`,
      );
      this.logger.debug(
        { destination: payload.destination },
        'SMS mock — OTP printed to console',
      );
      return;
    }

    this.logger.debug(
      { destination: payload.destination, otp: '[REDACTED]' },
      'sending SMS via End User Messaging',
    );

    const command = new SendTextMessageCommand({
      DestinationPhoneNumber: payload.destination,
      OriginationIdentity: this.originationIdentity,
      MessageBody: `Hola ${payload.customerName}, tu código de verificación es: ${payload.otp}`,
    });

    await this.client.send(command);
    this.logger.info({ destination: payload.destination }, 'OTP sent via SMS');
  }
}
