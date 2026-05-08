import { apiClient } from "./client";

export interface EstimateResult {
  side: "buy" | "sell";
  output: {
    tokensOut?: string;
    minTokensOut?: string;
    solOut?: string;
    minSolOut?: string;
  };
  fee: { lamports: string; bps: number };
  price: {
    effective: number;
    spotBefore: number;
    spotAfter: number;
    impactBps: number;
  };
  slippageBps: number;
}

export interface PrepareTradeResult {
  transaction: string;
  estimate: {
    tokensOut?: string;
    minTokensOut?: string;
    solOut?: string;
    minSolOut?: string;
    priceImpactBps: number;
  };
}

export async function estimateTrade(params: {
  identifier: string;
  side: "buy" | "sell";
  solAmount?: number;
  tokenAmount?: string;
  slippageBps?: number;
}): Promise<EstimateResult> {
  return apiClient.post("markets/estimate", { json: params }).json<EstimateResult>();
}

export async function prepareTrade(params: {
  identifier: string;
  side: "buy" | "sell";
  trader: string;
  solAmount?: number;
  tokenAmount?: string;
  slippageBps?: number;
}): Promise<PrepareTradeResult> {
  return apiClient.post("markets/prepare-trade", { json: params }).json<PrepareTradeResult>();
}
