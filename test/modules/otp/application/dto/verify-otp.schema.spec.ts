import { VerifyOtpSchema } from '../../../../../src/modules/otp/application/dto/verify-otp.schema';

const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

describe('VerifyOtpSchema', () => {
  describe('sessionId', () => {
    it('acepta UUID v4 válido', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: VALID_UUID,
        code: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza string que no es UUID', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: 'not-a-uuid',
        code: '123456',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza sessionId vacío', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: '',
        code: '123456',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza sessionId ausente', () => {
      const result = VerifyOtpSchema.safeParse({ code: '123456' });
      expect(result.success).toBe(false);
    });
  });

  describe('code', () => {
    it('acepta exactamente 6 dígitos', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: VALID_UUID,
        code: '000000',
      });
      expect(result.success).toBe(true);
    });

    it('acepta "999999"', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: VALID_UUID,
        code: '999999',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza 5 dígitos', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: VALID_UUID,
        code: '12345',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza 7 dígitos', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: VALID_UUID,
        code: '1234567',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza letras', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: VALID_UUID,
        code: 'abcdef',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza mezcla dígitos + letras', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: VALID_UUID,
        code: '12345a',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza code vacío', () => {
      const result = VerifyOtpSchema.safeParse({
        sessionId: VALID_UUID,
        code: '',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza code ausente', () => {
      const result = VerifyOtpSchema.safeParse({ sessionId: VALID_UUID });
      expect(result.success).toBe(false);
    });
  });

  it('rechaza body completamente vacío', () => {
    const result = VerifyOtpSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
