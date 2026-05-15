import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { OtpSessionData } from '../../domain/entities/otp-session.entity';
import type { OtpSessionRepositoryPort } from '../../domain/ports/otp-session-repository.port';
import { DynamoDBProvider } from '../../../../shared/dynamodb/dynamodb.provider';

@Injectable()
export class DynamoDbOtpSessionAdapter implements OtpSessionRepositoryPort {
  private readonly tableName: string;

  constructor(
    @InjectPinoLogger(DynamoDbOtpSessionAdapter.name)
    private readonly logger: PinoLogger,
    private readonly dynamoDb: DynamoDBProvider,
    private readonly config: ConfigService,
  ) {
    this.tableName = this.config.getOrThrow<string>('DYNAMODB_TABLE_NAME');
  }

  async save(sessionId: string, data: OtpSessionData): Promise<void> {
    this.logger.debug({ sessionId }, 'saving OTP session');

    await this.dynamoDb.getDocumentClient().send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          sessionId,
          ...data,
        },
      }),
    );

    this.logger.debug({ sessionId }, 'OTP session saved');
  }

  async findById(sessionId: string): Promise<OtpSessionData | null> {
    this.logger.debug({ sessionId }, 'looking up OTP session');

    const result = await this.dynamoDb.getDocumentClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: { sessionId },
      }),
    );

    if (!result.Item) {
      this.logger.debug({ sessionId }, 'OTP session not found');
      return null;
    }

    const item = result.Item as OtpSessionData & { sessionId: string };

    // Defensa contra TTL lazy de DynamoDB — el item puede seguir
    // siendo devuelto hasta 48h después de expirar
    const now = Math.floor(Date.now() / 1000);
    if (item.expiresAt <= now) {
      this.logger.warn({ sessionId }, 'OTP session found but already expired');
      return null;
    }

    this.logger.debug({ sessionId }, 'OTP session found');

    return {
      otpHash: item.otpHash,
      customerEncrypted: item.customerEncrypted,
      expiresAt: item.expiresAt,
    };
  }

  async delete(sessionId: string): Promise<void> {
    this.logger.debug({ sessionId }, 'deleting OTP session');

    await this.dynamoDb.getDocumentClient().send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { sessionId },
      }),
    );

    this.logger.debug({ sessionId }, 'OTP session deleted');
  }
}
