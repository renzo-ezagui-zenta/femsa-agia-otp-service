import { OtpSessionData } from '../entities/otp-session.entity';

export interface OtpSessionRepositoryPort {
  save(
    sessionId: string,
    data: OtpSessionData,
    ttlSeconds: number,
  ): Promise<void>;
  findById(sessionId: string): Promise<OtpSessionData | null>;
  delete(sessionId: string): Promise<void>;
  markVerified(sessionId: string, ttlSeconds: number): Promise<void>;
}
