import {
  computeHmac,
  encrypt,
  decrypt,
} from '../../../src/shared/crypto/otp-crypto';

const SECRET = 'test-secret-with-at-least-32-characters-ok!!';
const KEY_HEX = '00'.repeat(32); // 32 zero bytes

describe('computeHmac()', () => {
  it('retorna un string hex de 64 caracteres (SHA-256)', () => {
    const result = computeHmac('123456', SECRET);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('mismo valor + mismo secret → mismo hash (determinístico)', () => {
    expect(computeHmac('123456', SECRET)).toBe(computeHmac('123456', SECRET));
  });

  it('distinto valor → distinto hash', () => {
    expect(computeHmac('123456', SECRET)).not.toBe(
      computeHmac('000000', SECRET),
    );
  });

  it('distinto secret → distinto hash', () => {
    expect(computeHmac('123456', SECRET)).not.toBe(
      computeHmac('123456', 'otro-secret-de-al-menos-32-chars!!'),
    );
  });
});

describe('encrypt() / decrypt()', () => {
  it('retorna el formato iv:authTag:ciphertext', () => {
    const result = encrypt('hola mundo', KEY_HEX);
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/));
  });

  it('decrypt recupera el plaintext original', () => {
    const plaintext = '{"id":"c1","name":"Ana"}';
    const encoded = encrypt(plaintext, KEY_HEX);
    expect(decrypt(encoded, KEY_HEX)).toBe(plaintext);
  });

  it('cada llamada produce un ciphertext distinto (IV aleatorio)', () => {
    const a = encrypt('mismo texto', KEY_HEX);
    const b = encrypt('mismo texto', KEY_HEX);
    expect(a).not.toBe(b);
    // pero ambos se descifran al mismo plaintext
    expect(decrypt(a, KEY_HEX)).toBe(decrypt(b, KEY_HEX));
  });

  it('lanza si el ciphertext fue manipulado (authTag inválido)', () => {
    const encoded = encrypt('dato sensible', KEY_HEX);
    const [iv, authTag, ct] = encoded.split(':');
    // corrompe el ciphertext
    const corrupted = [iv, authTag, 'ff' + ct.slice(2)].join(':');
    expect(() => decrypt(corrupted, KEY_HEX)).toThrow();
  });

  it('lanza si el formato es inválido', () => {
    expect(() => decrypt('datos-sin-dos-puntos', KEY_HEX)).toThrow();
  });
});
