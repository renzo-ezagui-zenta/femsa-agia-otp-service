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

  describe('findById()', () => {
    it('retorna { status: "not_found" } cuando el item no existe', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({ Item: undefined });
      const result = await adapter.findById('sess-missing');
      expect(result).toEqual({ status: 'not_found' });
    });

    it('retorna { status: "expired" } y llama delete cuando el item está expirado', async () => {
      const { adapter, mockSend } = makeAdapter();
      // First call: GetCommand → expired item; second call: DeleteCommand
      mockSend
        .mockResolvedValueOnce({
          Item: {
            sessionId: 'sess-1',
            ...SESSION_DATA,
            expiresAt: Math.floor(Date.now() / 1000) - 10,
          },
        })
        .mockResolvedValueOnce({});

      const result = await adapter.findById('sess-1');

      expect(result).toEqual({ status: 'expired' });
      expect(mockSend).toHaveBeenCalledTimes(2);
      const deleteCommand = mockSend.mock.calls[1][0];
      expect(deleteCommand.input.TableName).toBe(TABLE);
      expect(deleteCommand.input.Key).toEqual({ sessionId: 'sess-1' });
    });

    it('retorna { status: "found", data } cuando el item existe y no está expirado', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({
        Item: { sessionId: 'sess-1', ...SESSION_DATA },
      });
      const result = await adapter.findById('sess-1');
      expect(result).toEqual({ status: 'found', data: SESSION_DATA });
    });

    it('no incluye sessionId en el data retornado', async () => {
      const { adapter, mockSend } = makeAdapter();
      mockSend.mockResolvedValueOnce({
        Item: { sessionId: 'sess-1', ...SESSION_DATA },
      });
      const result = await adapter.findById('sess-1');
      if (result.status === 'found') {
        expect(result.data).not.toHaveProperty('sessionId');
      } else {
        fail('expected status found');
      }
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
