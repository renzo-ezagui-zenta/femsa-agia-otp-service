import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBProvider } from '../../../shared/dynamodb/dynamodb.provider';

@Injectable()
export class DynamoDbHealthIndicator extends HealthIndicator {
  constructor(
    private readonly dynamoDb: DynamoDBProvider,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const tableName = this.config.getOrThrow<string>('DYNAMODB_TABLE_NAME');

    try {
      // DescribeTable es la operación más ligera para verificar conectividad
      // y existencia de la tabla en un solo call
      const response = await this.dynamoDb
        .getClient()
        .send(new DescribeTableCommand({ TableName: tableName }));

      const tableStatus = response.Table?.TableStatus;

      if (tableStatus !== 'ACTIVE') {
        throw new HealthCheckError(
          'DynamoDB health check failed',
          this.getStatus(key, false, {
            message: `Table status is ${tableStatus ?? 'UNKNOWN'}, expected ACTIVE`,
          }),
        );
      }

      return this.getStatus(key, true);
    } catch (err) {
      if (err instanceof HealthCheckError) throw err;
      throw new HealthCheckError(
        'DynamoDB health check failed',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
