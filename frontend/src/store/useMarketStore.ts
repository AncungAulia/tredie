import { create } from "zustand";

export type TokenCategory = "Trending" | "Latest";

interface MarketUIState {
  activeTokenCategory: TokenCategory;
  searchQuery: string;
  setTokenCategory: (category: TokenCategory) => void;
  setSearchQuery: (query: string) => void;
}

export const useMarketStore = create<MarketUIState>((set) => ({
  activeTokenCategory: "Trending",
  searchQuery: "",
  setTokenCategory: (category) => set({ activeTokenCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
