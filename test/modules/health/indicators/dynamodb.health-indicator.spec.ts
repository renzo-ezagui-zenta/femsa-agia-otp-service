import { HealthCheckError } from '@nestjs/terminus';
import { DynamoDbHealthIndicator } from '../../../../src/modules/health/indicators/dynamodb.health-indicator';

function makeIndicator(tableName = 'mcp-femsa-dev-otp-sessions') {
  const mockSend = jest.fn();
  const dynamoDb = {
    getClient: jest.fn().mockReturnValue({ send: mockSend }),
  } as any;
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(tableName),
  } as any;

  const indicator = new DynamoDbHealthIndicator(dynamoDb, configService);
  return { indicator, mockSend };
}

describe('DynamoDbHealthIndicator', () => {
  it('retorna status up cuando la tabla está ACTIVE', async () => {
    const { indicator, mockSend } = makeIndicator();
    mockSend.mockResolvedValueOnce({ Table: { TableStatus: 'ACTIVE' } });
    const result = await indicator.isHealthy('dynamodb');
    expect(result).toEqual({ dynamodb: { status: 'up' } });
  });

  it('lanza HealthCheckError cuando DynamoDB falla', async () => {
    const { indicator, mockSend } = makeIndicator();
    mockSend.mockRejectedValueOnce(new Error('ResourceNotFoundException'));
    await expect(indicator.isHealthy('dynamodb')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('incluye el mensaje de error en el detalle', async () => {
    expect.assertions(1);
    const { indicator, mockSend } = makeIndicator();
    mockSend.mockRejectedValueOnce(new Error('connection refused'));
    try {
      await indicator.isHealthy('dynamodb');
    } catch (e: any) {
      expect(e.causes).toMatchObject({
        dynamodb: { message: 'connection refused' },
      });
    }
  });

  it('lanza HealthCheckError cuando la tabla está en CREATING', async () => {
    const { indicator, mockSend } = makeIndicator();
    mockSend.mockResolvedValueOnce({ Table: { TableStatus: 'CREATING' } });
    await expect(indicator.isHealthy('dynamodb')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('lanza HealthCheckError cuando la tabla está en DELETING', async () => {
    const { indicator, mockSend } = makeIndicator();
    mockSend.mockResolvedValueOnce({ Table: { TableStatus: 'DELETING' } });
    await expect(indicator.isHealthy('dynamodb')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('incluye el TableStatus en el mensaje de error cuando no está ACTIVE', async () => {
    expect.assertions(1);
    const { indicator, mockSend } = makeIndicator();
    mockSend.mockResolvedValueOnce({ Table: { TableStatus: 'UPDATING' } });
    try {
      await indicator.isHealthy('dynamodb');
    } catch (e: any) {
      expect(e.causes).toMatchObject({
        dynamodb: { message: 'Table status is UPDATING, expected ACTIVE' },
      });
    }
  });
});
