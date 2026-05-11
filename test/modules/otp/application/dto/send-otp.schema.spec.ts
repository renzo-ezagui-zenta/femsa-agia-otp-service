import {
  SendOtpSchema,
  CustomerSchema,
} from '../../../../../src/modules/otp/application/dto/send-otp.schema';

const VALID_CUSTOMER = {
  id: 'cust-1',
  name: 'Ana García',
  phone: '+56912345678',
  mail: 'ana@example.com',
};

describe('SendOtpSchema', () => {
  describe('customer.phone', () => {
    it('acepta formato E.164 válido', () => {
      const result = SendOtpSchema.safeParse({
        customer: VALID_CUSTOMER,
        requestedVia: 'id',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza teléfono sin +', () => {
      const result = SendOtpSchema.safeParse({
        customer: { ...VALID_CUSTOMER, phone: '56912345678' },
        requestedVia: 'id',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza teléfono vacío', () => {
      const result = SendOtpSchema.safeParse({
        customer: { ...VALID_CUSTOMER, phone: '' },
        requestedVia: 'id',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza teléfono con letras', () => {
      const result = SendOtpSchema.safeParse({
        customer: { ...VALID_CUSTOMER, phone: '+56abc' },
        requestedVia: 'id',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('customer.mail', () => {
    it('acepta email válido', () => {
      const result = SendOtpSchema.safeParse({
        customer: VALID_CUSTOMER,
        requestedVia: 'id',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza email sin @', () => {
      const result = SendOtpSchema.safeParse({
        customer: { ...VALID_CUSTOMER, mail: 'invalidemail' },
        requestedVia: 'id',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza email vacío', () => {
      const result = SendOtpSchema.safeParse({
        customer: { ...VALID_CUSTOMER, mail: '' },
        requestedVia: 'id',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('customer.id y customer.name', () => {
    it('rechaza id vacío', () => {
      const result = SendOtpSchema.safeParse({
        customer: { ...VALID_CUSTOMER, id: '' },
        requestedVia: 'id',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza name vacío', () => {
      const result = SendOtpSchema.safeParse({
        customer: { ...VALID_CUSTOMER, name: '' },
        requestedVia: 'id',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('requestedVia', () => {
    it.each(['mail', 'phone', 'id'] as const)('acepta "%s"', (via) => {
      const result = SendOtpSchema.safeParse({
        customer: VALID_CUSTOMER,
        requestedVia: via,
      });
      expect(result.success).toBe(true);
    });

    it('rechaza valor fuera del enum', () => {
      const result = SendOtpSchema.safeParse({
        customer: VALID_CUSTOMER,
        requestedVia: 'sms',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza requestedVia ausente', () => {
      const result = SendOtpSchema.safeParse({ customer: VALID_CUSTOMER });
      expect(result.success).toBe(false);
    });
  });

  describe('campos faltantes', () => {
    it('rechaza body vacío', () => {
      const result = SendOtpSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rechaza customer ausente', () => {
      const result = SendOtpSchema.safeParse({ requestedVia: 'id' });
      expect(result.success).toBe(false);
    });
  });
});

describe('CustomerSchema', () => {
  it('parsea correctamente un customer válido', () => {
    const result = CustomerSchema.safeParse(VALID_CUSTOMER);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(VALID_CUSTOMER);
  });
});
