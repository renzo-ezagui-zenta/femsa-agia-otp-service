import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Computa HMAC-SHA256 del valor con la clave dada.
 * Función pura — facilita tests sin mocks de node:crypto.
 */
export function computeHmac(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Encripta texto plano con AES-256-GCM.
 * Retorna "<iv_hex>:<authTag_hex>:<ciphertext_hex>" — un solo string almacenable.
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Desencripta el formato "<iv_hex>:<authTag_hex>:<ciphertext_hex>" producido por encrypt().
 * Lanza si el authTag no es válido (datos manipulados).
 */
export function decrypt(encoded: string, keyHex: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encoded.split(':');
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
