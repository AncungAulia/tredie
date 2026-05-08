import { create } from "zustand";

export type TokenCategory = "All" | "Trending" | "On X";

interface MarketUIState {
  activeTokenCategory: TokenCategory;
  searchQuery: string;
  setTokenCategory: (category: TokenCategory) => void;
  setSearchQuery: (query: string) => void;
}

export const useMarketStore = create<MarketUIState>((set) => ({
  activeTokenCategory: "All",
  searchQuery: "",
  setTokenCategory: (category) => set({ activeTokenCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
