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
  expense_type?: string;
  participants?: string[];
  created_at: string;
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

export interface EventStats {
  total_expenses_cents: number;
  total_paid_cents: number;
  total_owed_cents: number;
  your_share_cents: number;
  your_paid_cents: number;
  your_balance_cents: number;
  member_count: number;
  expense_count: number;
  settled_count: number;
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
    const response = await apiClient.get<{ success: boolean; data: BalancesResponse; error: unknown }>(
      `/v1/events/${eventId}/balances?${params.toString()}`
    );
    if (!response.success) {
      throw new Error(response.error as string || 'Failed to get balances');
    }
    return response.data;
  },

  // Get simplified debts (minimal transfers to settle)
  getSimplifiedDebts: async (eventId: string, userId: string): Promise<SimplifiedDebtsResponse> => {
    const params = new URLSearchParams({ user_id: userId });
    const response = await apiClient.get<{ success: boolean; data: SimplifiedDebtsResponse; error: unknown }>(
      `/v1/events/${eventId}/balances/simplified?${params.toString()}`
    );
    if (!response.success) {
      throw new Error(response.error as string || 'Failed to get simplified debts');
    }
    return response.data;
  },

  // Get balance for a single user
  getUserBalance: async (eventId: string, userId: string): Promise<UserBalanceResponse> => {
    const params = new URLSearchParams({ user_id: userId });
    const response = await apiClient.get<{ success: boolean; data: UserBalanceResponse; error: unknown }>(
      `/v1/events/${eventId}/balances/${userId}?${params.toString()}`
    );
    if (!response.success) {
      throw new Error(response.error as string || 'Failed to get user balance');
    }
    return response.data;
  },

  // Get detailed breakdown of a user's balance
  explainUserBalance: async (eventId: string, userId: string): Promise<ExplainBalanceResponse> => {
    const params = new URLSearchParams({ user_id: userId });
    const response = await apiClient.get<{ success: boolean; data: ExplainBalanceResponse; error: unknown }>(
      `/v1/events/${eventId}/balances/${userId}/explain?${params.toString()}`
    );
    if (!response.success) {
      throw new Error(response.error as string || 'Failed to explain balance');
    }
    return response.data;
  },

  // Get event-level stats
  getStats: async (eventId: string, userId: string): Promise<EventStats> => {
    const params = new URLSearchParams({ user_id: userId });
    const response = await apiClient.get<{ success: boolean; data: EventStats; error: unknown }>(
      `/v1/events/${eventId}/balances/stats?${params.toString()}`
    );
    if (!response.success) {
      throw new Error(response.error as string || 'Failed to get event stats');
    }
    return response.data;
  },
};