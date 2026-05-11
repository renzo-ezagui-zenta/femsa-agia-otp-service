import { randomUUID } from 'node:crypto';

export type DeliveryChannel = 'sms' | 'mail';
export type RequestedVia = 'mail' | 'phone' | 'id';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  mail: string;
}

export interface OtpSessionData {
  customer: Customer;
  requestedVia: RequestedVia;
  deliveryChannel: DeliveryChannel;
  otp: string;
  verified: boolean;
}

const DELIVERY_CHANNEL_MAP: Record<RequestedVia, DeliveryChannel> = {
  mail: 'sms',
  phone: 'mail',
  id: 'sms',
};

/**
 * Formatea un entero aleatorio como código OTP de 6 dígitos con zero-padding.
 * Función pura — facilita tests sin mocks de node:crypto.
 */
export function formatOtpCode(rand: number): string {
  return rand.toString().padStart(6, '0');
}

export class OtpSession {
  readonly sessionId: string;
  readonly customer: Customer;
  readonly requestedVia: RequestedVia;
  readonly deliveryChannel: DeliveryChannel;
  readonly otp: string;
  readonly verified: boolean;
  readonly expiresAt: Date;

  private constructor(props: {
    sessionId: string;
    customer: Customer;
    requestedVia: RequestedVia;
    deliveryChannel: DeliveryChannel;
    otp: string;
    verified: boolean;
    expiresAt: Date;
  }) {
    this.sessionId = props.sessionId;
    this.customer = props.customer;
    this.requestedVia = props.requestedVia;
    this.deliveryChannel = props.deliveryChannel;
    this.otp = props.otp;
    this.verified = props.verified;
    this.expiresAt = props.expiresAt;
  }

  static create(
    customer: Customer,
    requestedVia: RequestedVia,
    ttlSeconds: number,
    otp: string,
  ): OtpSession {
    return new OtpSession({
      sessionId: randomUUID(),
      customer,
      requestedVia,
      deliveryChannel: DELIVERY_CHANNEL_MAP[requestedVia],
      otp,
      verified: false,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });
  }

  toData(): OtpSessionData {
    return {
      customer: this.customer,
      requestedVia: this.requestedVia,
      deliveryChannel: this.deliveryChannel,
      otp: this.otp,
      verified: this.verified,
    };
  }
}
