import { PublicKey } from "@solana/web3.js";
import { config } from "../config";

const PROGRAM_ID = new PublicKey(config.TREDIE_PROGRAM_ID);

const FACTORY_SEED = Buffer.from("factory");
const MARKET_SEED = Buffer.from("market");
const ORACLE_SEED = Buffer.from("oracle");

export const programId = PROGRAM_ID;

export function factoryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FACTORY_SEED], PROGRAM_ID);
}

/** Identifier dipad ke 32 bytes dengan zero. */
export function identifierToBytes(identifier: string): Buffer {
  const bytes = Buffer.from(identifier, "utf-8");
  if (bytes.length === 0 || bytes.length > 32) {
    throw new Error(`Identifier "${identifier}" must be 1..32 UTF-8 bytes`);
  }
  const padded = Buffer.alloc(32, 0);
  bytes.copy(padded);
  return padded;
}

export function identifierByteLen(identifier: string): number {
  return Buffer.from(identifier, "utf-8").length;
}

export function marketPda(identifier: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MARKET_SEED, identifierToBytes(identifier)],
    PROGRAM_ID,
  );
}

export function oraclePda(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ORACLE_SEED, market.toBuffer()], PROGRAM_ID);
}
