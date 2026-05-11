import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { NotificationPayload } from '../../domain/ports/notification.port';

@Injectable()
export class SesAdapter {
  private readonly client: SESClient;
  private readonly fromAddress: string;
  private readonly ttlMinutes: number;

  constructor(
    @InjectPinoLogger(SesAdapter.name) private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {
    this.client = new SESClient({
      region: this.config.getOrThrow<string>('AWS_REGION'),
    });
    this.fromAddress = this.config.getOrThrow<string>('SES_FROM_ADDRESS');
    this.ttlMinutes = Math.ceil(
      this.config.get<number>('OTP_TTL_SECONDS', 300) / 60,
    );
    this.logger.debug(
      { fromAddress: this.fromAddress },
      'SesAdapter initialized',
    );
  }

  async send(payload: NotificationPayload): Promise<void> {
    this.logger.debug(
      { destination: payload.destination, otp: '[REDACTED]' },
      'sending email via SES',
    );

    const command = new SendEmailCommand({
      Source: this.fromAddress,
      Destination: { ToAddresses: [payload.destination] },
      Message: {
        Subject: { Data: 'Tu código de verificación' },
        Body: {
          Text: { Data: this.buildTextBody(payload) },
          Html: { Data: this.buildHtmlBody(payload) },
        },
      },
    });

    await this.client.send(command);
    this.logger.info(
      { destination: payload.destination },
      'OTP sent via email',
    );
  }

  private buildTextBody({ customerName, otp }: NotificationPayload): string {
    return [
      `Hola ${customerName},`,
      '',
      'Tu código de verificación es:',
      '',
      `  ${otp}`,
      '',
      `Este código expira en ${this.ttlMinutes} minuto${this.ttlMinutes !== 1 ? 's' : ''}.`,
      '',
      'Si no solicitaste este código, ignorá este correo. Nunca compartas tu código con nadie.',
      '',
      '---',
      'Este es un mensaje automático, no respondas a este correo.',
    ].join('\n');
  }

  private buildHtmlBody({ customerName, otp }: NotificationPayload): string {
    const ttlLabel = `${this.ttlMinutes} minuto${this.ttlMinutes !== 1 ? 's' : ''}`;
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table style="width:100%;border-collapse:collapse;background:#f4f6f9;padding:40px 0;">
    <tr>
      <td style="text-align:center;">
        <table style="width:520px;border-collapse:collapse;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#005eb8;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.3px;">Código de verificación</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;color:#222222;font-size:16px;">Hola <strong>${customerName}</strong>,</p>
              <p style="margin:0 0 28px;color:#555555;font-size:15px;line-height:1.5;">
                Usa el siguiente código para completar tu verificación.<br>
                Expira en <strong>${ttlLabel}</strong>.
              </p>
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="text-align:center;background:#f0f4ff;border-radius:8px;padding:24px 16px;">
                    <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:40px;font-weight:bold;letter-spacing:10px;color:#005eb8;">${otp}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;color:#999999;font-size:13px;line-height:1.5;">
                Si no solicitaste este código, podés ignorar este correo con seguridad.<br>
                <strong>Nunca compartas tu código con nadie.</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eeeeee;">
              <p style="margin:0;color:#bbbbbb;font-size:12px;">Este es un mensaje automático — no respondas a este correo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
