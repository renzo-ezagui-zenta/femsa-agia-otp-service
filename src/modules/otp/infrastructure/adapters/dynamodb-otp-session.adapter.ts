import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { OtpSessionData } from '../../domain/entities/otp-session.entity';
import type {
  OtpSessionRepositoryPort,
  SessionLookupResult,
} from '../../domain/ports/otp-session-repository.port';
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

  /**
   * Atomically deletes the session and returns its data via ReturnValues: ALL_OLD.
   * ConditionalCheckFailedException means the item was already gone (consumed or
   * never existed) — only one concurrent caller can win.
   */
  async consumeById(sessionId: string): Promise<SessionLookupResult> {
    this.logger.debug({ sessionId }, 'consuming OTP session');

    try {
      const result = await this.dynamoDb.getDocumentClient().send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { sessionId },
          ConditionExpression: 'attribute_exists(sessionId)',
          ReturnValues: 'ALL_OLD',
        }),
      );

      if (!result.Attributes) {
        // Should not happen given the condition, but guard anyway
        this.logger.warn(
          { sessionId },
          'OTP session delete returned no attributes',
        );
        return { status: 'not_found' };
      }

      const item = result.Attributes as OtpSessionData & { sessionId: string };

      // Defensa contra TTL lazy de DynamoDB — el item puede seguir
      // siendo devuelto hasta 48h después de expirar
      const now = Math.floor(Date.now() / 1000);
      if (item.expiresAt <= now) {
        this.logger.warn({ sessionId }, 'OTP session was expired — discarding');
        return { status: 'expired' };
      }

      this.logger.debug({ sessionId }, 'OTP session consumed');

      return {
        status: 'found',
        data: {
          otpHash: item.otpHash,
          customerEncrypted: item.customerEncrypted,
          expiresAt: item.expiresAt,
        },
      };
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        this.logger.debug(
          { sessionId },
          'OTP session not found or already consumed',
        );
        return { status: 'not_found' };
      }
      throw err;
    }
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
