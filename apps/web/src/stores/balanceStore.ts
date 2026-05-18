import { create } from 'zustand';
import {
  balancesApi,
  BalancesResponse,
  SimplifiedDebtsResponse,
  ExplainBalanceResponse,
  EventStats,
} from '../api/balances.api';

interface BalanceState {
  selectedUserId: string | null;
  balances: BalancesResponse | null;
  simplifiedDebts: SimplifiedDebtsResponse | null;
  explainData: ExplainBalanceResponse | null;
  stats: EventStats | null;
  isLoading: boolean;
  error: string | null;
  setSelectedUserId: (id: string | null) => void;
  fetchBalances: (eventId: string, userId: string) => Promise<void>;
  fetchSimplifiedDebts: (eventId: string, userId: string) => Promise<void>;
  fetchExplainData: (eventId: string, userId: string) => Promise<void>;
  fetchStats: (eventId: string, userId: string) => Promise<void>;
  refetchAll: (eventId: string, userId: string) => Promise<void>;
  clear: () => void;
}

export const useBalanceStore = create<BalanceState>((set, get) => ({
  selectedUserId: null,
  balances: null,
  simplifiedDebts: null,
  explainData: null,
  stats: null,
  isLoading: false,
  error: null,

  setSelectedUserId: (id) => set({ selectedUserId: id }),

  fetchBalances: async (eventId, userId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await balancesApi.getAllBalances(eventId, userId);
      set({ balances: data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch balances';
      set({ error: message, isLoading: false });
    }
  },

  fetchSimplifiedDebts: async (eventId, userId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await balancesApi.getSimplifiedDebts(eventId, userId);
      set({ simplifiedDebts: data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch simplified debts';
      set({ error: message, isLoading: false });
    }
  },

  fetchExplainData: async (eventId, userId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await balancesApi.explainUserBalance(eventId, userId);
      set({ explainData: data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch explain data';
      set({ error: message, isLoading: false });
    }
  },

  fetchStats: async (eventId, userId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await balancesApi.getStats(eventId, userId);
      set({ stats: data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stats';
      set({ error: message, isLoading: false });
    }
  },

  refetchAll: async (eventId, userId) => {
    const { fetchBalances, fetchSimplifiedDebts, fetchStats } = get();
    await Promise.all([
      fetchBalances(eventId, userId),
      fetchSimplifiedDebts(eventId, userId),
      fetchStats(eventId, userId),
    ]);
  },

  clear: () => set({
    selectedUserId: null,
    balances: null,
    simplifiedDebts: null,
    explainData: null,
    stats: null,
    isLoading: false,
    error: null,
  }),
}));
