import crypto from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const createTotpSecret = () => {
  const bytes = crypto.randomBytes(20);
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
};

const decodeBase32 = (input: string) => {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of input.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Invalid TOTP secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const codeForCounter = (secret: string, counter: number) => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 15;
  const binary = ((digest[offset]! & 127) << 24) | ((digest[offset + 1]! & 255) << 16) | ((digest[offset + 2]! & 255) << 8) | (digest[offset + 3]! & 255);
  return String(binary % 1_000_000).padStart(6, "0");
};

export const generateTotpCode = (secret: string, timestamp = Date.now()) => codeForCounter(secret, Math.floor(timestamp / 30_000));

export const verifyTotp = (secret: string, code: string, timestamp = Date.now()) => {
  if (!/^\d{6}$/.test(code)) return false;
  const actual = Buffer.from(code);
  const counter = Math.floor(timestamp / 30_000);
  for (const skew of [-1, 0, 1]) {
    const expected = Buffer.from(codeForCounter(secret, counter + skew));
    if (crypto.timingSafeEqual(actual, expected)) return true;
  }
  return false;
};

const encryptionKey = () => {
  const encoded = process.env.MFA_ENCRYPTION_KEY;
  if (!encoded) throw new Error("MFA_ENCRYPTION_KEY is required for administrator MFA.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
};

export const encryptTotpSecret = (secret: string) => {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString("base64url")).join(".");
};

export const decryptTotpSecret = (encrypted: string) => {
  const [iv, tag, ciphertext] = encrypted.split(".").map((value) => Buffer.from(value, "base64url"));
  if (!iv || !tag || !ciphertext || iv.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted MFA secret.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
};

export const hashRecoveryCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

export const createRecoveryCodes = (count = 10) => Array.from({ length: count }, () => crypto.randomBytes(10).toString("base64url").toUpperCase());
