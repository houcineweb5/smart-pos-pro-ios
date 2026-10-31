/**
 * Security & Password Utility
 * Modern Scrypt Password Hashing + Verification + Timing-Safe Comparisons
 * @license Apache-2.0
 */

import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(
      plainText,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
      }
    );
  });
}

export async function verifyPassword(plainText: string, storedHash: string): Promise<boolean> {
  if (!plainText || !storedHash || typeof plainText !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  // If already scrypt-hashed format: scrypt$salt$hash
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const originalHash = parts[2];
    return new Promise<boolean>((resolve) => {
      crypto.scrypt(
        plainText,
        salt,
        SCRYPT_KEYLEN,
        { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
        (err, derivedKey) => {
          if (err) return resolve(false);
          const originalBuffer = Buffer.from(originalHash, 'hex');
          if (originalBuffer.length !== derivedKey.length) {
            return resolve(false);
          }
          resolve(crypto.timingSafeEqual(originalBuffer, derivedKey));
        }
      );
    });
  }

  // Legacy plaintext match (constant-time equivalent)
  const plainBuf = Buffer.from(plainText);
  const storedBuf = Buffer.from(storedHash);
  if (plainBuf.length !== storedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(plainBuf, storedBuf);
}

export function isHashed(storedHash: string): boolean {
  return typeof storedHash === 'string' && storedHash.startsWith('scrypt$');
}
