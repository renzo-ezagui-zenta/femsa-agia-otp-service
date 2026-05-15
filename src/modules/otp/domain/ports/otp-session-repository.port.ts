import { OtpSessionData } from '../entities/otp-session.entity';

export type SessionLookupResult =
  | { status: 'found'; data: OtpSessionData }
  | { status: 'not_found' }
  | { status: 'expired' };

export interface OtpSessionRepositoryPort {
  save(sessionId: string, data: OtpSessionData): Promise<void>;
  /**
   * Atomically deletes the session and returns its data.
   * Only one concurrent caller can win — the second gets 'not_found'.
   * Also handles the DynamoDB TTL lazy-deletion window by checking expiresAt
   * on the returned attributes before considering the session valid.
   */
  consumeById(sessionId: string): Promise<SessionLookupResult>;
  delete(sessionId: string): Promise<void>;
}
