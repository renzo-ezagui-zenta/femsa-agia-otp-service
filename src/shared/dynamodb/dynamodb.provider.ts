import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DynamoDBProvider implements OnModuleInit, OnModuleDestroy {
  private rawClient: DynamoDBClient;
  private documentClient: DynamoDBDocumentClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const region = this.configService.get<string>('AWS_REGION');
    const endpoint = this.configService.get<string>('DYNAMODB_ENDPOINT');

    this.rawClient = new DynamoDBClient({
      region,
      ...(endpoint ? { endpoint } : {}),
    });

    this.documentClient = DynamoDBDocumentClient.from(this.rawClient);
  }

  onModuleDestroy(): void {
    this.rawClient?.destroy();
  }

  /** Cliente de alto nivel para operaciones CRUD (Get, Put, Delete, Query) */
  getDocumentClient(): DynamoDBDocumentClient {
    return this.documentClient;
  }

  /** Cliente base para operaciones de tabla (DescribeTable, ListTables, etc.) */
  getClient(): DynamoDBClient {
    return this.rawClient;
  }
}
