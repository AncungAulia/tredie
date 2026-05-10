export type TokenCategory = "All" | "Trending" | "On X" | "On TG";

export interface TokenMarket {
  id: string;
  ticker: string;
  name: string;
  category: TokenCategory;
  price: number;
  priceDelta: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  attentionScore: number;
  attentionDelta: number;
  ratchetMultiplier: number;
  sparkline: number[];
}

export const mockTokenMarkets: TokenMarket[] = [
  {
    id: "tkn_1",
    ticker: "att:BONK",
    name: "BONK",
    category: "Trending",
    price: 0.00002134,
    priceDelta: 12.5,
    marketCap: 1500000,
    volume24h: 890000,
    holders: 3200,
    attentionScore: 78.4,
    attentionDelta: 15.2,
    ratchetMultiplier: 2.1,
    sparkline: [30, 32, 35, 38, 42, 45, 50, 55, 60, 62, 65, 68, 72, 75, 78],
  },
  {
    id: "tkn_2",
    ticker: "att:WIF",
    name: "dogwifhat",
    category: "Trending",
    price: 0.00089,
    priceDelta: 28.3,
    marketCap: 4200000,
    volume24h: 2100000,
    holders: 5400,
    attentionScore: 91.2,
    attentionDelta: 34.5,
    ratchetMultiplier: 3.8,
    sparkline: [15, 18, 20, 25, 30, 38, 45, 55, 60, 70, 75, 82, 88, 90, 91],
  },
  {
    id: "tkn_3",
    ticker: "att:JUP",
    name: "Jupiter",
    category: "Trending",
    price: 0.0145,
    priceDelta: -3.2,
    marketCap: 8900000,
    volume24h: 1200000,
    holders: 4100,
    attentionScore: 64.1,
    attentionDelta: -4.8,
    ratchetMultiplier: 1.4,
    sparkline: [70, 68, 67, 66, 65, 66, 64, 65, 63, 64, 63, 64, 64, 64, 64],
  },
  {
    id: "tkn_4",
    ticker: "att:PEPE",
    name: "Pepe",
    category: "On X",
    price: 0.0000089,
    priceDelta: 45.1,
    marketCap: 12000000,
    volume24h: 8500000,
    holders: 18200,
    attentionScore: 95.5,
    attentionDelta: 42.0,
    ratchetMultiplier: 4.5,
    sparkline: [20, 22, 28, 35, 40, 50, 55, 65, 70, 78, 82, 88, 92, 94, 95],
  },
  {
    id: "tkn_5",
    ticker: "att:RENDER",
    name: "Render",
    category: "On X",
    price: 0.042,
    priceDelta: 5.8,
    marketCap: 6800000,
    volume24h: 1500000,
    holders: 3900,
    attentionScore: 58.3,
    attentionDelta: 8.1,
    ratchetMultiplier: 1.9,
    sparkline: [40, 42, 43, 45, 44, 46, 48, 50, 52, 53, 55, 56, 57, 58, 58],
  },
  {
    id: "tkn_6",
    ticker: "att:POPCAT",
    name: "Popcat",
    category: "On TG",
    price: 0.00032,
    priceDelta: 18.9,
    marketCap: 2100000,
    volume24h: 950000,
    holders: 2800,
    attentionScore: 72.0,
    attentionDelta: 22.3,
    ratchetMultiplier: 2.6,
    sparkline: [25, 28, 30, 35, 40, 42, 48, 52, 55, 60, 62, 65, 68, 70, 72],
  },
  {
    id: "tkn_7",
    ticker: "att:MEW",
    name: "cat in a dogs world",
    category: "On TG",
    price: 0.0018,
    priceDelta: -8.4,
    marketCap: 980000,
    volume24h: 320000,
    holders: 1200,
    attentionScore: 41.5,
    attentionDelta: -12.1,
    ratchetMultiplier: 1.0,
    sparkline: [60, 58, 55, 54, 50, 48, 46, 45, 44, 43, 42, 42, 41, 41, 41],
  },
  {
    id: "tkn_8",
    ticker: "att:TNSR",
    name: "Tensor",
    category: "Trending",
    price: 0.0082,
    priceDelta: 1.2,
    marketCap: 3400000,
    volume24h: 680000,
    holders: 2100,
    attentionScore: 52.8,
    attentionDelta: 2.4,
    ratchetMultiplier: 1.3,
    sparkline: [48, 49, 50, 50, 51, 50, 52, 51, 52, 52, 53, 52, 53, 53, 53],
  },
];
