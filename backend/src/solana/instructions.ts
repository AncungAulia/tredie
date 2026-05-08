import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { createHash } from "crypto";
import { connection } from "./connection";
import { signer } from "./signer";
import {
  factoryPda,
  marketPda,
  oraclePda,
  identifierToBytes,
  identifierByteLen,
  programId,
} from "./pda";

// Canonical MPL Token Metadata program (mainnet + devnet stable address).
export const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u16LE(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}
function u32LE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}
function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

/** Borsh String layout: u32 LE byte-length + UTF-8 bytes. */
function borshString(s: string): Buffer {
  const bytes = Buffer.from(s, "utf-8");
  return Buffer.concat([u32LE(bytes.length), bytes]);
}

/** Metaplex metadata account PDA: [b"metadata", MPL_PROGRAM, mint]. */
function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    MPL_TOKEN_METADATA_PROGRAM_ID,
  )[0];
}

// ── init_factory(fee_basis_points: u16) ──────────────────────────────────
export async function buildInitFactoryTx(opts: {
  feeRecipient: PublicKey;
  feeBasisPoints: number;
}): Promise<Transaction> {
  const [factory] = factoryPda();
  const data = Buffer.concat([disc("init_factory"), u16LE(opts.feeBasisPoints)]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: factory, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: true },
      { pubkey: opts.feeRecipient, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── create_market ────────────────────────────────────────────────────────
// Post-989ab3f: program performs a CPI to MPL Token Metadata using `name` and
// `uri` provided here. The on-chain side derives the SPL `symbol` from the
// identifier UTF-8 bytes, so for trend markets with long slugs the CPI may
// fail with SymbolTooLong (MPL caps symbol at 10). Caller is responsible for
// keeping the symbol portion ≤10 bytes if metadata creation is required.
export async function buildCreateMarketTx(opts: {
  identifier: string;
  assetClass: number;
  mintKeypairPubkey: PublicKey;
  oracleAuthority: PublicKey;
  baseVirtualSol?: bigint;
  virtualTokenSupply?: bigint;
  elasticityBps?: number;
  /** Metaplex `name` field. Capped at 32 chars by MPL. Defaults to identifier. */
  name?: string;
  /** Metaplex `uri` field. Capped at 200 chars. Defaults to "". */
  uri?: string;
}): Promise<Transaction> {
  const {
    identifier,
    assetClass,
    mintKeypairPubkey,
    oracleAuthority,
    baseVirtualSol = 30_000_000_000n,
    virtualTokenSupply = 1_000_000_000_000_000n,
    elasticityBps = 5000,
    name,
    uri = "",
  } = opts;

  const idBytes = identifierToBytes(identifier);
  const idLen = identifierByteLen(identifier);

  // Clamp to MPL caps. If caller didn't pass name, default to identifier
  // (prefer human-readable when caller has it).
  const mplName = (name ?? identifier).slice(0, 32);
  const mplUri = uri.slice(0, 200);

  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);
  const metadataAcc = metadataPda(mintKeypairPubkey);

  const data = Buffer.concat([
    disc("create_market"),
    idBytes, // [u8; 32]
    Buffer.from([idLen]), // u8
    Buffer.from([assetClass]), // u8
    u64LE(baseVirtualSol),
    u64LE(virtualTokenSupply),
    u32LE(elasticityBps),
    borshString(mplName),
    borshString(mplUri),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: factory, isSigner: false, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: mintKeypairPubkey, isSigner: true, isWritable: true },
      { pubkey: oracle, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: true },
      { pubkey: oracleAuthority, isSigner: false, isWritable: false },
      { pubkey: metadataAcc, isSigner: false, isWritable: true },
      { pubkey: MPL_TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── update_mindshare(new_mindshare_bps: u32) ─────────────────────────────
export async function buildUpdateMindshareTx(opts: {
  identifier: string;
  newMindshareBps: number;
}): Promise<Transaction> {
  const [market] = marketPda(opts.identifier);
  const [oracle] = oraclePda(market);

  const data = Buffer.concat([disc("update_mindshare"), u32LE(opts.newMindshareBps)]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: market, isSigner: false, isWritable: false },
      { pubkey: oracle, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── buy(sol_amount_in: u64, min_tokens_out: u64) ─────────────────────────
export async function buildBuyTx(opts: {
  buyer: PublicKey;
  identifier: string;
  mintPubkey: PublicKey;
  solAmountIn: bigint;
  minTokensOut: bigint;
}): Promise<Transaction> {
  const { buyer, identifier, mintPubkey, solAmountIn, minTokensOut } = opts;
  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);
  const buyerAta = await getAssociatedTokenAddress(mintPubkey, buyer);

  // factory.fee_recipient di offset 8 (disc) + 1 (bump) + 32 (authority) = 41
  const factoryAcc = await connection.getAccountInfo(factory);
  if (!factoryAcc) throw new Error("Factory account not found — run init_factory first");
  const feeRecipient = new PublicKey(factoryAcc.data.subarray(41, 73));

  const data = Buffer.concat([disc("buy"), u64LE(solAmountIn), u64LE(minTokensOut)]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: factory, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: mintPubkey, isSigner: false, isWritable: true },
      { pubkey: oracle, isSigner: false, isWritable: false },
      { pubkey: buyerAta, isSigner: false, isWritable: true },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = buyer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── sell(tokens_in: u64, min_sol_out: u64) ───────────────────────────────
export async function buildSellTx(opts: {
  seller: PublicKey;
  identifier: string;
  mintPubkey: PublicKey;
  tokensIn: bigint;
  minSolOut: bigint;
}): Promise<Transaction> {
  const { seller, identifier, mintPubkey, tokensIn, minSolOut } = opts;
  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);
  const sellerAta = await getAssociatedTokenAddress(mintPubkey, seller);

  const factoryAcc = await connection.getAccountInfo(factory);
  if (!factoryAcc) throw new Error("Factory account not found");
  const feeRecipient = new PublicKey(factoryAcc.data.subarray(41, 73));

  const data = Buffer.concat([disc("sell"), u64LE(tokensIn), u64LE(minSolOut)]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: factory, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: mintPubkey, isSigner: false, isWritable: true },
      { pubkey: oracle, isSigner: false, isWritable: false },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = seller;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── send + confirm (backend-signed only) ─────────────────────────────────
export async function sendAndConfirm(
  tx: Transaction,
  additionalSigners: Keypair[] = [],
): Promise<string> {
  tx.sign(signer, ...additionalSigners);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}
