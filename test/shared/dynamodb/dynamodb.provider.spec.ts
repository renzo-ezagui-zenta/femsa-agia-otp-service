import { DynamoDBProvider } from '../../../src/shared/dynamodb/dynamodb.provider';

describe('DynamoDBProvider', () => {
  let provider: DynamoDBProvider;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'DYNAMODB_ENDPOINT') return undefined;
        return undefined;
      }),
    };
    provider = new DynamoDBProvider(configService as any);
  });

  it('getDocumentClient() retorna el cliente después de onModuleInit', () => {
    provider.onModuleInit();
    expect(provider.getDocumentClient()).toBeDefined();
  });

  it('getClient() retorna el cliente base después de onModuleInit', () => {
    provider.onModuleInit();
    expect(provider.getClient()).toBeDefined();
  });

  it('getDocumentClient() y getClient() son instancias distintas', () => {
    provider.onModuleInit();
    expect(provider.getDocumentClient()).not.toBe(provider.getClient());
  });

  it('usa el endpoint opcional si DYNAMODB_ENDPOINT está definido', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'AWS_REGION') return 'us-east-1';
      if (key === 'DYNAMODB_ENDPOINT') return 'http://localhost:8000';
      return undefined;
    });
    expect(() => provider.onModuleInit()).not.toThrow();
    expect(provider.getDocumentClient()).toBeDefined();
  });
});
