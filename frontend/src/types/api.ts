export type AssetClass = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type TradeSide = 0 | 1; // 0=buy, 1=sell

export interface Market {
  identifier: string;
  display_name: string | null;
  asset_class: AssetClass;
  pda: string;
  mint: string;
  image_url: string | null;
  source_url: string | null;
  current_mindshare_bps: number;
  ratchet_multiplier_bps: number;
  real_sol_reserves: string;
  virtual_token_supply: string;
  tokens_minted: string;
  base_virtual_sol: string;
  volume_24h_lamports: string;
  holders_count: string;
  sparkline_24h: number[];
  market_cap_sparkline_24h: string[];
  created_at: string;
}

export interface MindshareEntry {
  recorded_at: string;
  current_bps: number;
  source: "rest_poll" | "auto_event";
  tx_signature: string | null;
}

export interface Trade {
  signature: string;
  side: TradeSide;
  sol_amount: string;
  token_amount: string;
  block_time: string;
  slot: string;
  trader: string;
}

export interface Holder {
  rank: number;
  trader: string;
  net_tokens: string;
  tokens_bought: string;
  tokens_sold: string;
  share_bps: number;
}

export interface MarketDetail extends Market {
  mindshare_history: MindshareEntry[];
  recent_trades: Trade[];
  holders: Holder[];
  stats: {
    spot_price_lamports_per_token: number;
    price_change_24h_bps: number;
    volume_24h_lamports: string;
    trade_count_24h: string;
    holders_count: string;
  };
}

export interface OHLCCandle {
  time?: number;
  bucket?: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
}

export interface MindsharePoint {
  bucket: string | number;
  bps: number;
}

export interface OHLCResponse {
  interval: string;
  candles: OHLCCandle[];
  mindshareSeries?: MindsharePoint[];
  source?: "trades" | "mindshare_history";
}

export type OHLCInterval = "5m" | "10m" | "15m" | "1h" | "4h" | "1d";

export interface PortfolioPosition {
  market_pda: string;
  identifier: string;
  display_name: string | null;
  asset_class: AssetClass;
  mint: string;
  tokens_bought: string;
  tokens_sold: string;
  tokens_held: string;
  sol_invested_lamports: string;
  sol_received_lamports: string;
  avg_entry_price_lamports: number;
  current_spot_price_lamports: number;
  held_value_lamports: string;
  held_cost_basis_lamports: string;
  realized_pnl_lamports: string;
  unrealized_pnl_lamports: string;
  buy_count: string;
  sell_count: string;
  first_buy_at: string | null;
  last_trade_at: string | null;
}

export interface PortfolioStats {
  total_trades: number;
  buy_count: number;
  sell_count: number;
  closed_trades: number;
  win_rate_bps: number;
  total_volume_lamports: string;
  sol_spent_lamports: string;
  sol_received_lamports: string;
  realized_pnl_lamports: string;
  unrealized_pnl_lamports: string;
  total_held_value_lamports: string;
  avg_profit_per_trade_lamports: number;
}

export interface PortfolioActivity {
  signature: string;
  market_pda: string;
  identifier: string;
  display_name: string | null;
  side: TradeSide;
  sol_amount: string;
  token_amount: string;
  block_time: string;
  slot: string;
}

export interface Portfolio {
  address: string;
  positions: PortfolioPosition[];
  stats: PortfolioStats;
  activity: PortfolioActivity[];
}

export interface EstimateRequest {
  market_pda: string;
  side: TradeSide;
  sol_amount?: string;
  token_amount?: string;
  slippage_bps?: number;
}

export interface EstimateResponse {
  side: TradeSide;
  tokens_out: string;
  min_tokens_out: string;
  sol_out: string;
  min_sol_out: string;
  effective_price_lamports: number;
  spot_price_before_lamports: number;
  spot_price_after_lamports: number;
  price_impact_bps: number;
  slippage_bps: number;
}

export interface PrepareTradeRequest {
  market_pda: string;
  trader: string;
  side: TradeSide;
  sol_amount?: string;
  token_amount?: string;
  slippage_bps?: number;
}

export interface PrepareTradeResponse {
  transaction: string;
  estimate: EstimateResponse;
}

export interface SearchResult {
  identifier: string;
  display_name: string | null;
  asset_class: AssetClass;
  pda: string | null;
  suggestion_type: "market" | "ca_suggestion";
}

export interface ResolveLinkResponse {
  identifier: string | null;
  display_name: string | null;
  asset_class: AssetClass | null;
  market_pda: string | null;
  suggested_market_path: string | null;
  source_url: string;
}

export interface TrendingToken {
  symbol: string;
  mention_count: number;
  mindshare_pct: number;
  market: Market | null;
  fetched_at: string;
}

export interface TrendingCA {
  ca: string;
  mention_count: number;
  market: Market | null;
  fetched_at: string;
}
