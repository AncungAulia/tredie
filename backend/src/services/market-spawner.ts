import { Keypair } from "@solana/web3.js";
import { buildCreateMarketTx, sendAndConfirm } from "../solana/instructions";
import { signer } from "../solana/signer";
import { marketPda } from "../solana/pda";
import { connection } from "../solana/connection";
import { decodeMarket } from "../solana/decoder";
import * as db from "../db";
import * as autoManager from "./auto-manager";
import { log } from "../utils/log";

const DEFAULT_BASE_VIRTUAL_SOL = 30_000_000_000n;
const DEFAULT_VIRTUAL_TOKEN_SUPPLY = 1_000_000_000_000_000n;
const DEFAULT_ELASTICITY_BPS = 5000;

export class MarketSpawner {
  /**
   * In-flight spawn promises keyed by identifier. Concurrent callers asking
   * for the same identifier await the same promise instead of racing into N
   * parallel `create_market` txs. Critical when multiple cron-fired pollAlls
   * (or hot-reload duplicates) hand off the same candidate before any of
   * them reaches the DB persist step.
   */
  private inflight = new Map<string, Promise<db.MarketRow>>();

  async ensureMarket(params: {
    identifier: string;
    assetClass: number;
    source: "auto_spawn" | "user_search" | "user_link_paste";
    displayName?: string | null;
    imageUrl?: string | null;
    sourceUrl?: string | null;
    sourceMetadata?: object | null;
  }): Promise<db.MarketRow> {
    const { identifier } = params;

    // 1. DB cache hit — fastest path
    const existing = await db.getMarketByIdentifier(identifier);
    if (existing) return existing;

    // 2. On-chain check — market PDA might exist from prior run/another env.
    //    Decode + sync to DB.
    const synced = await this.syncFromChain(params);
    if (synced) return synced;

    // 3. In-flight spawn for the same identifier — await the existing
    //    promise instead of racing.
    const inflight = this.inflight.get(identifier);
    if (inflight) return inflight;

    const p = (async () => {
      try {
        return await this.spawn(params);
      } finally {
        this.inflight.delete(identifier);
      }
    })();
    this.inflight.set(identifier, p);
    return p;
  }

  /**
   * If the Market PDA exists on-chain but DB doesn't have it, decode the
   * on-chain account and upsert it. Returns the row if synced, null otherwise.
   */
  private async syncFromChain(params: {
    identifier: string;
    displayName?: string | null;
    imageUrl?: string | null;
    sourceUrl?: string | null;
    sourceMetadata?: object | null;
    source: "auto_spawn" | "user_search" | "user_link_paste";
  }): Promise<db.MarketRow | null> {
    const { identifier } = params;
    const [marketPubkey] = marketPda(identifier);
    const acc = await connection.getAccountInfo(marketPubkey);
    if (!acc) return null;

    let decoded;
    try {
      decoded = decodeMarket(acc.data);
    } catch (e) {
      log.warn(
        { err: e, identifier, pda: marketPubkey.toBase58() },
        "Failed to decode existing market account",
      );
      return null;
    }

    log.info(
      { identifier, pda: marketPubkey.toBase58(), assetClass: decoded.assetClass },
      "Market exists on-chain, syncing to DB",
    );

    await db.upsertMarket({
      pda: marketPubkey.toBase58(),
      mint: decoded.mint,
      identifier,
      asset_class: decoded.assetClass,
      display_name: params.displayName ?? null,
      image_url: params.imageUrl ?? null,
      source_url: params.sourceUrl ?? null,
      source_metadata: params.sourceMetadata ?? null,
      base_virtual_sol: decoded.baseVirtualSol,
      virtual_token_supply: decoded.virtualTokenSupply,
      real_sol_reserves: decoded.realSolReserves,
      tokens_minted: decoded.tokensMinted,
      creator_pubkey: decoded.creator,
      creator_source: params.source,
      created_at: decoded.createdAt * 1000n, // on-chain unix sec → epoch ms
    });

    return (await db.getMarketByIdentifier(identifier))!;
  }

  private async spawn(
    params: Parameters<MarketSpawner["ensureMarket"]>[0],
  ): Promise<db.MarketRow> {
    const { identifier, assetClass, source } = params;
    log.info({ identifier, assetClass, source }, "Spawning market");

    const mintKeypair = Keypair.generate();

    const tx = await buildCreateMarketTx({
      identifier,
      assetClass,
      mintKeypairPubkey: mintKeypair.publicKey,
      oracleAuthority: signer.publicKey,
      baseVirtualSol: DEFAULT_BASE_VIRTUAL_SOL,
      virtualTokenSupply: DEFAULT_VIRTUAL_TOKEN_SUPPLY,
      elasticityBps: DEFAULT_ELASTICITY_BPS,
      // MPL Token Metadata params (post-989ab3f). Use display_name if provided
      // (more human-readable), else fall back to identifier.
      name: params.displayName ?? identifier,
      uri: "",
    });

    const sig = await sendAndConfirm(tx, [mintKeypair]);
    log.info({ identifier, sig }, "Market spawned on-chain");

    const [market] = marketPda(identifier);

    await db.upsertMarket({
      pda: market.toBase58(),
      mint: mintKeypair.publicKey.toBase58(),
      identifier,
      asset_class: assetClass,
      display_name: params.displayName ?? null,
      image_url: params.imageUrl ?? null,
      source_url: params.sourceUrl ?? null,
      source_metadata: params.sourceMetadata ?? null,
      base_virtual_sol: DEFAULT_BASE_VIRTUAL_SOL,
      virtual_token_supply: DEFAULT_VIRTUAL_TOKEN_SUPPLY,
      creator_pubkey: signer.publicKey.toBase58(),
      creator_source: source,
      created_at: BigInt(Date.now()),
    });

    const row = (await db.getMarketByIdentifier(identifier))!;

    autoManager
      .createHypeWatcher(row)
      .catch((e) => log.warn({ err: e, identifier }, "Auto hype watcher failed"));

    return row;
  }
}

export const marketSpawner = new MarketSpawner();
