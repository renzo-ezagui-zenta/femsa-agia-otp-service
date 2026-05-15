import { OtpSessionData } from '../entities/otp-session.entity';

export type SessionLookupResult =
  | { status: 'found'; data: OtpSessionData }
  | { status: 'not_found' }
  | { status: 'expired' };

export interface OtpSessionRepositoryPort {
  save(sessionId: string, data: OtpSessionData): Promise<void>;
  findById(sessionId: string): Promise<SessionLookupResult>;
  delete(sessionId: string): Promise<void>;
}
