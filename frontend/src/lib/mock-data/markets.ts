export type MarketCategory = "All" | "People" | "Brands" | "Events" | "Crypto";

export interface Market {
  id: string;
  ticker: string;
  name: string;
  category: MarketCategory;
  mindshare: number;
  mindshareDelta: number;
  price: number;
  priceDelta: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  ratchetMultiplier: number;
  sparkline: number[];
}

export const mockMarkets: Market[] = [
  {
    id: "mkt_1",
    ticker: "xyz:NVDA",
    name: "NVIDIA Earnings",
    category: "Brands",
    mindshare: 84.5,
    mindshareDelta: 12.4,
    price: 0.8421,
    priceDelta: 14.32,
    marketCap: 12800000,
    volume24h: 2400000,
    holders: 4821,
    ratchetMultiplier: 2.4,
    sparkline: [20, 22, 24, 23, 28, 32, 30, 35, 38, 42, 40, 45, 50, 48, 55, 60, 58, 65, 70, 72, 78, 80, 84]
  },
  {
    id: "mkt_2",
    ticker: "xyz:SAM",
    name: "Sam Altman",
    category: "People",
    mindshare: 92.1,
    mindshareDelta: 45.2,
    price: 1.2340,
    priceDelta: 18.50,
    marketCap: 34000000,
    volume24h: 12000000,
    holders: 8420,
    ratchetMultiplier: 3.5,
    sparkline: [10, 12, 15, 14, 18, 22, 25, 30, 35, 40, 50, 55, 60, 70, 72, 80, 85, 88, 90, 91, 92]
  },
  {
    id: "mkt_3",
    ticker: "xyz:SOL",
    name: "Solana Breakpoint",
    category: "Crypto",
    mindshare: 65.4,
    mindshareDelta: -2.4,
    price: 0.2100,
    priceDelta: -4.20,
    marketCap: 8500000,
    volume24h: 1200000,
    holders: 2890,
    ratchetMultiplier: 1.5,
    sparkline: [70, 72, 71, 68, 70, 67, 66, 65, 67, 64, 66, 65, 63, 65, 66, 64, 65, 65]
  },
  {
    id: "mkt_4",
    ticker: "xyz:ELEC",
    name: "US Elections",
    category: "Events",
    mindshare: 98.5,
    mindshareDelta: 5.1,
    price: 4.5200,
    priceDelta: 8.40,
    marketCap: 125000000,
    volume24h: 45000000,
    holders: 32400,
    ratchetMultiplier: 5.0,
    sparkline: [60, 62, 65, 68, 70, 72, 75, 78, 80, 82, 85, 87, 90, 92, 95, 96, 97, 98, 98.5]
  },
  {
    id: "mkt_5",
    ticker: "xyz:ELON",
    name: "Elon Musk",
    category: "People",
    mindshare: 76.2,
    mindshareDelta: 8.7,
    price: 0.5610,
    priceDelta: 6.30,
    marketCap: 9200000,
    volume24h: 3100000,
    holders: 5120,
    ratchetMultiplier: 2.8,
    sparkline: [30, 35, 33, 40, 42, 45, 50, 48, 55, 58, 60, 62, 65, 68, 70, 72, 74, 76]
  },
  {
    id: "mkt_6",
    ticker: "xyz:BTC",
    name: "Bitcoin ETF Flow",
    category: "Crypto",
    mindshare: 88.3,
    mindshareDelta: 3.2,
    price: 2.1500,
    priceDelta: 2.85,
    marketCap: 52000000,
    volume24h: 18000000,
    holders: 15600,
    ratchetMultiplier: 4.2,
    sparkline: [70, 72, 74, 73, 75, 78, 80, 79, 82, 84, 83, 85, 86, 87, 88, 88]
  },
  {
    id: "mkt_7",
    ticker: "xyz:AAPL",
    name: "Apple WWDC",
    category: "Brands",
    mindshare: 71.5,
    mindshareDelta: -1.2,
    price: 0.3820,
    priceDelta: -2.10,
    marketCap: 6800000,
    volume24h: 980000,
    holders: 2340,
    ratchetMultiplier: 1.8,
    sparkline: [75, 74, 73, 74, 72, 73, 71, 72, 70, 71, 72, 71, 70, 72, 71]
  },
  {
    id: "mkt_8",
    ticker: "xyz:FIFA",
    name: "FIFA World Cup",
    category: "Events",
    mindshare: 55.8,
    mindshareDelta: 22.4,
    price: 0.1540,
    priceDelta: 32.50,
    marketCap: 4200000,
    volume24h: 2800000,
    holders: 6700,
    ratchetMultiplier: 1.2,
    sparkline: [10, 12, 15, 18, 22, 28, 35, 38, 42, 45, 48, 50, 52, 54, 55]
  },
  {
    id: "mkt_9",
    ticker: "xyz:VB",
    name: "Vitalik Buterin",
    category: "People",
    mindshare: 62.0,
    mindshareDelta: -5.4,
    price: 0.1890,
    priceDelta: -3.70,
    marketCap: 3100000,
    volume24h: 540000,
    holders: 1890,
    ratchetMultiplier: 1.6,
    sparkline: [72, 70, 68, 67, 65, 66, 64, 63, 64, 62, 63, 62, 61, 62]
  },
];

export const mockPortfolioStats = {
  totalValue: 0.00,
  realizedPnl: 0.00,
  volume: 0.00,
  avgProfitPerTrade: 0.00,
  tradesCount: 0,
  winRate: 0,
};
