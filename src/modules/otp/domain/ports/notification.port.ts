export interface NotificationPayload {
  channel: 'sms' | 'mail';
  destination: string;
  customerName: string;
  otp: string;
}

export interface NotificationPort {
  send(payload: NotificationPayload): Promise<void>;
}
