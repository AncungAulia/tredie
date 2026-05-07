/**
 * Real backend-signed buy — for testing trade-indexer end-to-end with real
 * Helius webhook delivery (not synthetic simulator).
 *
 * Usage: bun run backend:buy -- BTC 0.05
 */

import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { buildBuyTx, sendAndConfirm } from "../solana/instructions";
import { signer } from "../solana/signer";
import { connection } from "../solana/connection";
import * as db from "../db";

const [identifier, solStr] = process.argv.slice(2);
if (!identifier || !solStr) {
  console.error("Usage: bun run backend:buy -- <identifier> <solAmount>");
  process.exit(1);
}
const solAmount = Number(solStr);

(async () => {
  const market = await db.getMarketByIdentifier(identifier);
  if (!market) throw new Error(`Market "${identifier}" not in DB`);

  const mintPk = new PublicKey(market.mint);
  const buyerAta = await getAssociatedTokenAddress(mintPk, signer.publicKey);

  // ATA may not exist yet — buildBuyTx assumes it does. Pre-create if needed.
  const ataInfo = await connection.getAccountInfo(buyerAta);
  if (!ataInfo) {
    console.log(`Creating ATA ${buyerAta.toBase58()} for ${signer.publicKey.toBase58()}`);
    const createAtaIx = createAssociatedTokenAccountInstruction(
      signer.publicKey,
      buyerAta,
      signer.publicKey,
      mintPk,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const tx = new Transaction().add(createAtaIx);
    tx.feePayer = signer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const sig = await sendAndConfirm(tx);
    console.log(`  ATA created: ${sig}`);
  }

  console.log(`Buying ${solAmount} SOL of ${identifier}...`);
  const buyTx = await buildBuyTx({
    buyer: signer.publicKey,
    identifier,
    mintPubkey: mintPk,
    solAmountIn: BigInt(Math.floor(solAmount * 1e9)),
    minTokensOut: 0n, // accept any
  });
  const sig = await sendAndConfirm(buyTx);
  console.log(`✓ buy tx: ${sig}`);
  console.log(`  https://solscan.io/tx/${sig}?cluster=devnet`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
