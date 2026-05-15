import { Global, Module } from '@nestjs/common';
import { DynamoDBProvider } from './dynamodb.provider';

@Global()
@Module({
  providers: [DynamoDBProvider],
  exports: [DynamoDBProvider],
})
export class DynamoDbModule {}
