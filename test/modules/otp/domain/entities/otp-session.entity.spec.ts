import {
  OtpSession,
  formatOtpCode,
} from '../../../../../src/modules/otp/domain/entities/otp-session.entity';

const CUSTOMER = {
  id: 'cust-1',
  name: 'Ana García',
  phone: '+56912345678',
  mail: 'ana@example.com',
};

describe('formatOtpCode()', () => {
  it('zero-padea a 6 dígitos', () => {
    expect(formatOtpCode(42)).toBe('000042');
  });

  it('límite inferior: 0 → "000000"', () => {
    expect(formatOtpCode(0)).toBe('000000');
  });

  it('límite superior: 999999 → "999999"', () => {
    expect(formatOtpCode(999999)).toBe('999999');
  });

  it('número de 6 dígitos no agrega padding', () => {
    expect(formatOtpCode(123456)).toBe('123456');
  });
});

describe('OtpSession', () => {
  describe('create()', () => {
    it('genera un sessionId UUID válido', () => {
      const session = OtpSession.create(CUSTOMER, 'id', 300, '123456');
      expect(session.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('cada llamada genera un sessionId único', () => {
      const a = OtpSession.create(CUSTOMER, 'id', 300, '123456');
      const b = OtpSession.create(CUSTOMER, 'id', 300, '123456');
      expect(a.sessionId).not.toBe(b.sessionId);
    });

    it('almacena el OTP recibido sin modificarlo', () => {
      const session = OtpSession.create(CUSTOMER, 'id', 300, '042000');
      expect(session.otp).toBe('042000');
    });

    it('expiresAt es aproximadamente ahora + ttlSeconds', () => {
      const before = Date.now();
      const session = OtpSession.create(CUSTOMER, 'id', 300, '123456');
      const after = Date.now();
      const expiresMs = session.expiresAt.getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 300 * 1000);
      expect(expiresMs).toBeLessThanOrEqual(after + 300 * 1000);
    });

    it('expiresAtEpoch es expiresAt en segundos Unix', () => {
      const session = OtpSession.create(CUSTOMER, 'id', 300, '123456');
      expect(session.expiresAtEpoch).toBe(
        Math.floor(session.expiresAt.getTime() / 1000),
      );
    });

    it('copia el customer sin mutación', () => {
      const session = OtpSession.create(CUSTOMER, 'id', 300, '123456');
      expect(session.customer).toEqual(CUSTOMER);
    });

    describe('routing de canal (requestedVia → deliveryChannel)', () => {
      it('mail → sms', () => {
        const session = OtpSession.create(CUSTOMER, 'mail', 300, '123456');
        expect(session.deliveryChannel).toBe('sms');
        expect(session.requestedVia).toBe('mail');
      });

      it('phone → mail', () => {
        const session = OtpSession.create(CUSTOMER, 'phone', 300, '123456');
        expect(session.deliveryChannel).toBe('mail');
        expect(session.requestedVia).toBe('phone');
      });

      it('id → sms', () => {
        const session = OtpSession.create(CUSTOMER, 'id', 300, '123456');
        expect(session.deliveryChannel).toBe('sms');
        expect(session.requestedVia).toBe('id');
      });
    });
  });
});
