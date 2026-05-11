import { apiClient } from './client';

// Types for balances
export interface UserBalanceItem {
  user_id: string;
  paid_cents: number;
  owes_cents: number;
  balance_cents: number;
}

export interface BalancesResponse {
  balances: UserBalanceItem[];
}

export interface DebtTransfer {
  from_user: string;
  to_user: string;
  amount_cents: number;
}

export interface SimplifiedDebtsResponse {
  transfers: DebtTransfer[];
}

export interface UserBalanceResponse {
  user_id: string;
  paid_cents: number;
  owes_cents: number;
  balance_cents: number;
}

export interface ExpenseBreakdown {
  title: string;
  amount_cents: number;
  paid_cents: number;
  share_cents: number;
  paid_by: string;
}

export interface PaymentBreakdown {
  from_user: string;
  to_user: string;
  amount_cents: number;
}

export interface SettlementBreakdown {
  from_user: string;
  to_user: string;
  amount_cents: number;
  status: string;
}

export interface ExplainBalanceResponse {
  user_id: string;
  paid_cents: number;
  owes_cents: number;
  balance_cents: number;
  expenses: ExpenseBreakdown[];
  payments: PaymentBreakdown[];
  settlements: SettlementBreakdown[];
}

// API calls
export const balancesApi = {
  // Get all user balances for an event
  getAllBalances: async (eventId: string, userId: string): Promise<BalancesResponse> => {
    const params = new URLSearchParams({ user_id: userId });
    return apiClient.get<BalancesResponse>(`/v1/events/${eventId}/balances?${params.toString()}`);
  },

  // Get simplified debts (minimal transfers to settle)
  getSimplifiedDebts: async (eventId: string, userId: string): Promise<SimplifiedDebtsResponse> => {
    const params = new URLSearchParams({ user_id: userId });
    return apiClient.get<SimplifiedDebtsResponse>(`/v1/events/${eventId}/balances/simplified?${params.toString()}`);
  },

  // Get balance for a single user
  getUserBalance: async (eventId: string, userId: string): Promise<UserBalanceResponse> => {
    const params = new URLSearchParams({ user_id: userId });
    return apiClient.get<UserBalanceResponse>(`/v1/events/${eventId}/balances/${userId}?${params.toString()}`);
  },

  // Get detailed breakdown of a user's balance
  explainUserBalance: async (eventId: string, userId: string): Promise<ExplainBalanceResponse> => {
    const params = new URLSearchParams({ user_id: userId });
    return apiClient.get<ExplainBalanceResponse>(`/v1/events/${eventId}/balances/${userId}/explain?${params.toString()}`);
  },
};