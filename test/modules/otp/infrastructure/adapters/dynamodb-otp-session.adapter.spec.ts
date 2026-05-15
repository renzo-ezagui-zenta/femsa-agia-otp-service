import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDbOtpSessionAdapter } from '../../../../../src/modules/otp/infrastructure/adapters/dynamodb-otp-session.adapter';
import type { OtpSessionData } from '../../../../../src/modules/otp/domain/entities/otp-session.entity';
import { mockLogger } from '../../../../helpers/logger.mock';

const TABLE = 'mcp-femsa-dev-otp-sessions';

const SESSION_DATA: OtpSessionData = {
  otpHash: 'abc123def456'.padEnd(64, '0'),
  customerEncrypted: 'ivhex:authtaghex:cipherhex',
  expiresAt: Math.floor(Date.now() / 1000) + 300,
};

function makeAdapter() {
  const mockSend = jest.fn();
  const dynamoDb = {
    getDocumentClient: jest.fn().mockReturnValue({ send: mockSend }),
  } as any;
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(TABLE),
  } as any;

  const adapter = new DynamoDbOtpSessionAdapter(
    mockLogger(),
    dynamoDb,
    configService,
  );
  return { adapter, mockSend };
}

describe('DynamoDbOtpSessionAdapter', () => {
  describe('save()', () => {
    it('llama PutCommand con TableName y Item correctos', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({});
      await adapter.save('sess-1', SESSION_DATA);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.TableName).toBe(TABLE);
      expect(command.input.Item).toMatchObject({
        sessionId: 'sess-1',
        ...SESSION_DATA,
      });
    });
  });

  describe('consumeById()', () => {
    it('retorna { status: "not_found" } cuando ConditionalCheckFailedException', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockRejectedValueOnce(
        new ConditionalCheckFailedException({ message: '', $metadata: {} }),
      );
      const result = await adapter.consumeById('sess-missing');
      expect(result).toEqual({ status: 'not_found' });
    });

    it('retorna { status: "not_found" } cuando Attributes está vacío (guard)', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({ Attributes: undefined });
      const result = await adapter.consumeById('sess-1');
      expect(result).toEqual({ status: 'not_found' });
    });

    it('retorna { status: "expired" } cuando el item está expirado', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({
        Attributes: {
          sessionId: 'sess-1',
          ...SESSION_DATA,
          expiresAt: Math.floor(Date.now() / 1000) - 10,
        },
      });
      const result = await adapter.consumeById('sess-1');
      expect(result).toEqual({ status: 'expired' });
    });

    it('retorna { status: "found", data } cuando el item existe y no está expirado', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({
        Attributes: { sessionId: 'sess-1', ...SESSION_DATA },
      });
      const result = await adapter.consumeById('sess-1');
      expect(result).toEqual({ status: 'found', data: SESSION_DATA });
    });

    it('no incluye sessionId en el data retornado', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({
        Attributes: { sessionId: 'sess-1', ...SESSION_DATA },
      });
      const result = await adapter.consumeById('sess-1');
      if (result.status === 'found') {
        expect(result.data).not.toHaveProperty('sessionId');
      } else {
        fail('expected status found');
      }
    });

    it('usa ConditionExpression attribute_exists y ReturnValues ALL_OLD', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({
        Attributes: { sessionId: 'sess-1', ...SESSION_DATA },
      });
      await adapter.consumeById('sess-1');
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ConditionExpression).toBe(
        'attribute_exists(sessionId)',
      );
      expect(command.input.ReturnValues).toBe('ALL_OLD');
    });

    it('propaga errores que no sean ConditionalCheckFailedException', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockRejectedValueOnce(
        new Error('ProvisionedThroughputExceededException'),
      );
      await expect(adapter.consumeById('sess-1')).rejects.toThrow(
        'ProvisionedThroughputExceededException',
      );
    });

    it('hace una sola llamada a DynamoDB (delete atómica, sin get separado)', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({
        Attributes: { sessionId: 'sess-1', ...SESSION_DATA },
      });
      await adapter.consumeById('sess-1');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete()', () => {
    it('llama DeleteCommand con TableName y Key correctos', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({});
      await adapter.delete('sess-1');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.TableName).toBe(TABLE);
      expect(command.input.Key).toEqual({ sessionId: 'sess-1' });
    });
  });
});
