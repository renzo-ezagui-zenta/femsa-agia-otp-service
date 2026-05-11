import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  NotificationPayload,
  NotificationPort,
} from '../../domain/ports/notification.port';
import { SesAdapter } from './ses.adapter';
import { EndUserMessagingAdapter } from './end-user-messaging.adapter';

@Injectable()
export class NotificationService implements NotificationPort {
  constructor(
    @InjectPinoLogger(NotificationService.name)
    private readonly logger: PinoLogger,
    private readonly ses: SesAdapter,
    private readonly endUserMessaging: EndUserMessagingAdapter,
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    this.logger.debug(
      { channel: payload.channel, destination: payload.destination },
      'routing notification',
    );

    if (payload.channel === 'sms') {
      await this.endUserMessaging.send(payload);
    } else {
      await this.ses.send(payload);
    }
  }
}
