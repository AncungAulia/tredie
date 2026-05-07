import { create } from 'zustand';
import { Market, mockMarkets, MarketCategory } from '@/lib/mock-data/markets';

interface MarketState {
  markets: Market[];
  activeCategory: MarketCategory;
  searchQuery: string;
  setCategory: (category: MarketCategory) => void;
  setSearchQuery: (query: string) => void;
  getFilteredMarkets: () => Market[];
}

export const useMarketStore = create<MarketState>((set, get) => ({
  markets: mockMarkets,
  activeCategory: "All",
  searchQuery: "",
  setCategory: (category) => set({ activeCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  getFilteredMarkets: () => {
    const { markets, activeCategory, searchQuery } = get();
    return markets.filter((m) => {
      const matchesCategory = activeCategory === "All" || m.category === activeCategory;
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            m.ticker.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }
}));
