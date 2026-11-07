import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function encryptionKey() {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!value) throw new Error("Integration encryption is not configured");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Integration encryption key must be 32 bytes");
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Encrypted integration credential is invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(parts[0], "base64"));
  decipher.setAuthTag(Buffer.from(parts[1], "base64"));
  return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64")), decipher.final()]).toString("utf8");
}

export function hashLinkCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function verifyLineSignature(body: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const actual = Buffer.from(signature, "base64");
  const hmac = createHmac("sha256", secret).update(body).digest();
  return actual.length === hmac.length && timingSafeEqual(actual, hmac);
}

export function randomLinkCode() {
  return randomBytes(5).toString("hex").toUpperCase();
}
