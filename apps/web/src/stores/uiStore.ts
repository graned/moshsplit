import { create } from 'zustand';

interface UIState {
  addExpenseOpen: boolean;
  crewDrawerOpen: boolean;
  settleDrawerOpen: boolean;
  balanceExplainOpen: boolean;
  selectedActivityFilter: string | null;
  setAddExpenseOpen: (open: boolean) => void;
  setCrewDrawerOpen: (open: boolean) => void;
  setSettleDrawerOpen: (open: boolean) => void;
  setBalanceExplainOpen: (open: boolean) => void;
  setSelectedActivityFilter: (filter: string | null) => void;
  resetFilters: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  addExpenseOpen: false,
  crewDrawerOpen: false,
  settleDrawerOpen: false,
  balanceExplainOpen: false,
  selectedActivityFilter: null,

  setAddExpenseOpen: (open) => set({ addExpenseOpen: open }),
  setCrewDrawerOpen: (open) => set({ crewDrawerOpen: open }),
  setSettleDrawerOpen: (open) => set({ settleDrawerOpen: open }),
  setBalanceExplainOpen: (open) => set({ balanceExplainOpen: open }),
  setSelectedActivityFilter: (filter) => set({ selectedActivityFilter: filter }),

  resetFilters: () => set({
    selectedActivityFilter: null,
    addExpenseOpen: false,
    crewDrawerOpen: false,
    settleDrawerOpen: false,
    balanceExplainOpen: false,
  }),
}));
