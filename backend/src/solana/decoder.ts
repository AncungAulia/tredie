import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

const TRADE_DISC = createHash("sha256").update("event:Trade").digest().subarray(0, 8);

export interface TradeEvent {
  market: string;
  side: 0 | 1;
  solAmount: bigint;
  tokenAmount: bigint;
  ratchetBps: number;
  trader: string;
  timestamp: bigint;
}

/**
 * Decoded Market account state from on-chain bytes.
 * Layout matches `programs/programs/tredie/src/state/market.rs` Market struct.
 *   8 bytes: Anchor discriminator
 *   1 byte:  bump
 *   32 bytes: factory pubkey
 *   32 bytes: mint pubkey
 *   32 bytes: creator pubkey
 *   32 bytes: identifier ([u8;32])
 *   1 byte:  identifier_len
 *   1 byte:  asset_class
 *   8 bytes: base_virtual_sol u64 LE
 *   8 bytes: virtual_token_supply u64 LE
 *   8 bytes: real_sol_reserves u64 LE
 *   8 bytes: tokens_minted u64 LE
 *   8 bytes: created_at i64 LE
 *   32 bytes: mindshare_oracle pubkey
 *  Total: 211 bytes
 */
export interface DecodedMarket {
  bump: number;
  factory: string;
  mint: string;
  creator: string;
  identifier: string;
  identifierBytes: Buffer;
  identifierLen: number;
  assetClass: number;
  baseVirtualSol: bigint;
  virtualTokenSupply: bigint;
  realSolReserves: bigint;
  tokensMinted: bigint;
  createdAt: bigint;
  mindshareOracle: string;
}

export function decodeMarket(data: Buffer): DecodedMarket {
  if (data.length < 211) {
    throw new Error(`Market account too small: ${data.length} bytes`);
  }
  let off = 8; // skip discriminator
  const bump = data.readUInt8(off); off += 1;
  const factory = new PublicKey(data.subarray(off, off + 32)); off += 32;
  const mint = new PublicKey(data.subarray(off, off + 32)); off += 32;
  const creator = new PublicKey(data.subarray(off, off + 32)); off += 32;
  const identifierBytes = Buffer.from(data.subarray(off, off + 32)); off += 32;
  const identifierLen = data.readUInt8(off); off += 1;
  const assetClass = data.readUInt8(off); off += 1;
  const baseVirtualSol = data.readBigUInt64LE(off); off += 8;
  const virtualTokenSupply = data.readBigUInt64LE(off); off += 8;
  const realSolReserves = data.readBigUInt64LE(off); off += 8;
  const tokensMinted = data.readBigUInt64LE(off); off += 8;
  const createdAt = data.readBigInt64LE(off); off += 8;
  const mindshareOracle = new PublicKey(data.subarray(off, off + 32));

  return {
    bump,
    factory: factory.toBase58(),
    mint: mint.toBase58(),
    creator: creator.toBase58(),
    identifier: identifierBytes.subarray(0, identifierLen).toString("utf-8"),
    identifierBytes,
    identifierLen,
    assetClass,
    baseVirtualSol,
    virtualTokenSupply,
    realSolReserves,
    tokensMinted,
    createdAt,
    mindshareOracle: mindshareOracle.toBase58(),
  };
}

/**
 * MindshareOracle account (`programs/programs/tredie/src/state/oracle.rs`):
 *   8 bytes: Anchor discriminator
 *   1 byte:  bump
 *   32 bytes: market pubkey
 *   32 bytes: authority pubkey
 *   4 bytes: current_mindshare_bps u32 LE
 *   4 bytes: peak_mindshare_bps u32 LE
 *   4 bytes: ratchet_multiplier_bps u32 LE
 *   4 bytes: elasticity_bps u32 LE
 *   8 bytes: last_update_slot u64 LE
 *   8 bytes: last_update_unix i64 LE
 *   8 bytes: min_update_interval_secs i64 LE
 *   8 bytes: update_count u64 LE
 *  Total: 121 bytes
 */
export interface DecodedOracle {
  bump: number;
  market: string;
  authority: string;
  currentMindshareBps: number;
  peakMindshareBps: number;
  ratchetMultiplierBps: number;
  elasticityBps: number;
  lastUpdateSlot: bigint;
  lastUpdateUnix: bigint;
  minUpdateIntervalSecs: bigint;
  updateCount: bigint;
}

export function decodeOracle(data: Buffer): DecodedOracle {
  if (data.length < 121) {
    throw new Error(`Oracle account too small: ${data.length} bytes`);
  }
  let off = 8;
  const bump = data.readUInt8(off); off += 1;
  const market = new PublicKey(data.subarray(off, off + 32)); off += 32;
  const authority = new PublicKey(data.subarray(off, off + 32)); off += 32;
  const currentMindshareBps = data.readUInt32LE(off); off += 4;
  const peakMindshareBps = data.readUInt32LE(off); off += 4;
  const ratchetMultiplierBps = data.readUInt32LE(off); off += 4;
  const elasticityBps = data.readUInt32LE(off); off += 4;
  const lastUpdateSlot = data.readBigUInt64LE(off); off += 8;
  const lastUpdateUnix = data.readBigInt64LE(off); off += 8;
  const minUpdateIntervalSecs = data.readBigInt64LE(off); off += 8;
  const updateCount = data.readBigUInt64LE(off);

  return {
    bump,
    market: market.toBase58(),
    authority: authority.toBase58(),
    currentMindshareBps,
    peakMindshareBps,
    ratchetMultiplierBps,
    elasticityBps,
    lastUpdateSlot,
    lastUpdateUnix,
    minUpdateIntervalSecs,
    updateCount,
  };
}

/**
 * MarketFactory account (`programs/programs/tredie/src/state/factory.rs`):
 *   8 bytes: Anchor discriminator
 *   1 byte:  bump
 *   32 bytes: authority pubkey
 *   32 bytes: fee_recipient pubkey
 *   8 bytes: market_count u64 LE
 *   2 bytes: fee_basis_points u16 LE
 *   1 byte:  paused bool
 *  Total: 84 bytes
 */
export interface DecodedFactory {
  bump: number;
  authority: string;
  feeRecipient: string;
  marketCount: bigint;
  feeBasisPoints: number;
  paused: boolean;
}

export function decodeFactory(data: Buffer): DecodedFactory {
  if (data.length < 84) {
    throw new Error(`Factory account too small: ${data.length} bytes`);
  }
  let off = 8;
  const bump = data.readUInt8(off); off += 1;
  const authority = new PublicKey(data.subarray(off, off + 32)); off += 32;
  const feeRecipient = new PublicKey(data.subarray(off, off + 32)); off += 32;
  const marketCount = data.readBigUInt64LE(off); off += 8;
  const feeBasisPoints = data.readUInt16LE(off); off += 2;
  const paused = data.readUInt8(off) !== 0;

  return {
    bump,
    authority: authority.toBase58(),
    feeRecipient: feeRecipient.toBase58(),
    marketCount,
    feeBasisPoints,
    paused,
  };
}

/** Parse "Program data:" log lines untuk Trade event. */
export function parseTradeEvents(logs: string[]): TradeEvent[] {
  const events: TradeEvent[] = [];
  for (const line of logs) {
    if (!line.startsWith("Program data: ")) continue;
    const b64 = line.slice("Program data: ".length).trim();
    let buf: Buffer;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      continue;
    }
    if (buf.length < 8) continue;
    if (!buf.subarray(0, 8).equals(TRADE_DISC)) continue;

    let off = 8;
    const market = new PublicKey(buf.subarray(off, off + 32));
    off += 32;
    const side = buf.readUInt8(off);
    off += 1;
    const solAmount = buf.readBigUInt64LE(off);
    off += 8;
    const tokenAmount = buf.readBigUInt64LE(off);
    off += 8;
    const ratchetBps = buf.readUInt32LE(off);
    off += 4;
    const trader = new PublicKey(buf.subarray(off, off + 32));
    off += 32;
    const timestamp = buf.readBigInt64LE(off);

    events.push({
      market: market.toBase58(),
      side: side === 0 ? 0 : 1,
      solAmount,
      tokenAmount,
      ratchetBps,
      trader: trader.toBase58(),
      timestamp,
    });
  }
  return events;
}
