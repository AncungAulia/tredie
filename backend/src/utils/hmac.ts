import { createHash, createHmac } from "crypto";

export function sha256(data: string): Buffer {
  return createHash("sha256").update(data).digest();
}

export function hmacSha256Hex(key: Buffer, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}
