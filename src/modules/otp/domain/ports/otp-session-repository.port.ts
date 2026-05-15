import { OtpSessionData } from '../entities/otp-session.entity';
import { Customer } from '../entities/otp-session.entity';

export interface OtpSessionRepositoryPort {
  save(sessionId: string, data: OtpSessionData): Promise<void>;
  findById(sessionId: string): Promise<OtpSessionData | null>;
  delete(sessionId: string): Promise<void>;
}

export type { Customer };
