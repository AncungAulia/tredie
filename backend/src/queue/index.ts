import { log } from "../utils/log";
import * as db from "../db";
import { oracleUpdater } from "../services/oracle-updater";
import { config } from "../config";

type JobType = "auto_event";

interface Job {
  type: JobType;
  data: any;
}

class InMemoryQueue {
  private jobs: Job[] = [];
  private processing = false;

  push(type: JobType, data: any) {
    this.jobs.push({ type, data });
    if (!this.processing) this.next();
  }

  private async next() {
    if (this.jobs.length === 0) {
      this.processing = false;
      return;
    }
    this.processing = true;
    const job = this.jobs.shift()!;
    try {
      await this.handle(job);
      if (job.type === "auto_event") {
        await db.markAutoEventProcessed(job.data.eventId, "success");
      }
    } catch (e) {
      log.error({ err: e, job }, "Queue job failed");
      if (job.type === "auto_event") {
        await db.markAutoEventProcessed(job.data.eventId, "failed");
      }
    }
    setTimeout(() => this.next(), 100);
  }

  private async handle(job: Job) {
    if (job.type !== "auto_event") return;
    const { payload } = job.data;
    const q = await db.getAutoQuery(payload.queryId);
    if (!q || q.query_type !== "hype_event" || !q.market_pda) return;

    const market = await db.getMarketByPda(q.market_pda);
    if (!market) return;

    const boosted = Math.min(
      market.peak_mindshare_bps + config.HYPE_EVENT_PREMIUM_BPS,
      100_000,
    );
    if (boosted > market.peak_mindshare_bps) {
      await oracleUpdater.submit(market.pda, market.identifier, boosted);
    }
    log.info({ identifier: market.identifier, boosted }, "Hype event processed");
  }
}

export const queue = new InMemoryQueue();
