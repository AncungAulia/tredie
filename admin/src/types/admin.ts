export type CandidateVerdict =
  | "pending"
  | "spawn"
  | "skip"
  | "merge"
  | "manual_approve"
  | "manual_reject"
  | "spawn_failed";

export interface MarketCandidate {
  id: string;
  source_kind: string;
  source_key: string;
  raw_input: unknown;
  verdict: CandidateVerdict;
  ai_identifier: string | null;
  ai_display_name: string | null;
  ai_asset_class: number | null;
  ai_confidence_bps: number | null;
  ai_reason: string | null;
  ai_model: string | null;
  merged_with: string | null;
  spawn_market_pda: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface CandidatesResponse {
  count: number;
  candidates: MarketCandidate[];
}
