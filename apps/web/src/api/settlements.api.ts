import { apiClient } from './client';
import { ActivityItem } from './activity.api';

export interface Settlement {
  id: string;
  event_id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  status: string;
  settled_at?: string;
  created_by: string;
  created_at: string;
  note?: string;
  proof_url?: string;
  expense_id?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_note?: string;
}

export interface SettlementListItem {
  id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  status: string;
  created_at: string;
  note?: string;
  proof_url?: string;
  created_by: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_note?: string;
}

// Incoming balance — someone owes the current user
export interface IncomingBalanceItem {
  user_id: string;
  amount_cents: number; // always positive
  created_at: string;
}

export interface IncomingBalancesResponse {
  items: IncomingBalanceItem[];
  total_cents: number;
}

// Outgoing balance — the current user owes someone
export interface OutgoingBalanceItem {
  user_id: string;
  amount_cents: number; // always positive
  reason?: string;
  created_at: string;
}

export interface OutgoingBalancesResponse {
  items: OutgoingBalanceItem[];
  total_cents: number;
}

// Settlement history — past settlements/payments
export interface SettlementHistoryItem {
  id: string;
  amount_cents: number; // signed: + = incoming (received), - = outgoing (paid)
  counterparty_id: string;
  created_at: string;
  note?: string;
  is_outgoing: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface CreateSettlementRequest {
  from_user: string;
  to_user: string;
  amount_cents: number;
  note?: string;
  proof_url?: string;
  expense_id?: string;
}

export interface UpdateSettlementStatusRequest {
  status: string;
}

export interface ApproveSettlementRequest {}

export interface RejectSettlementRequest {
  rejection_note?: string;
}

export const settlementsApi = {
  list: async (
    eventId: string,
    userId: string,
    cursor?: string,
    limit = 20,
    status?: string
  ): Promise<{ data: SettlementListItem[]; hasMore: boolean; nextCursor?: string }> => {
    const params = new URLSearchParams({ limit: String(limit), user_id: userId });
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    const response = await apiClient.get<{
      data: { items: SettlementListItem[]; pagination: { has_more: boolean; next_cursor?: string } };
    }>(`/v1/events/${eventId}/settlements?${params.toString()}`);
    return {
      data: response.data.items,
      hasMore: response.data.pagination.has_more,
      nextCursor: response.data.pagination.next_cursor,
    };
  },

  get: async (eventId: string, settlementId: string): Promise<Settlement> => {
    const response = await apiClient.get<{ success: boolean; data: Settlement; error: unknown }>(
      `/v1/events/${eventId}/settlements/${settlementId}`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get settlement');
    }
    return response.data;
  },

  create: async (eventId: string, data: CreateSettlementRequest): Promise<Settlement> => {
    const response = await apiClient.post<{ success: boolean; data: Settlement; error: unknown }>(
      `/v1/events/${eventId}/settlements`,
      data
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to create settlement');
    }
    return response.data;
  },

  updateStatus: async (eventId: string, settlementId: string, status: string): Promise<Settlement> => {
    const response = await apiClient.patch<{ success: boolean; data: Settlement; error: unknown }>(
      `/v1/events/${eventId}/settlements/${settlementId}`,
      { status }
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to update settlement');
    }
    return response.data;
  },

  approve: async (eventId: string, settlementId: string): Promise<Settlement> => {
    const response = await apiClient.post<{ success: boolean; data: Settlement; error: unknown }>(
      `/v1/events/${eventId}/settlements/${settlementId}/approve`,
      {}
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to approve settlement');
    }
    return response.data;
  },

  withdraw: async (eventId: string, settlementId: string): Promise<Settlement> => {
    const response = await apiClient.post<{ success: boolean; data: Settlement; error: unknown }>(
      `/v1/events/${eventId}/settlements/${settlementId}/withdraw`,
      {}
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to withdraw settlement');
    }
    return response.data;
  },

  reject: async (eventId: string, settlementId: string, rejectionNote?: string): Promise<Settlement> => {
    const response = await apiClient.post<{ success: boolean; data: Settlement; error: unknown }>(
      `/v1/events/${eventId}/settlements/${settlementId}/reject`,
      { rejection_note: rejectionNote }
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to reject settlement');
    }
    return response.data;
  },

  getIncomingBalances: async (eventId: string): Promise<IncomingBalancesResponse> => {
    const response = await apiClient.get<{ success: boolean; data: IncomingBalancesResponse; error: unknown }>(
      `/v1/events/${eventId}/settlements/incoming`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get incoming balances');
    }
    return response.data;
  },

  getOutgoingBalances: async (eventId: string): Promise<OutgoingBalancesResponse> => {
    const response = await apiClient.get<{ success: boolean; data: OutgoingBalancesResponse; error: unknown }>(
      `/v1/events/${eventId}/settlements/outgoing`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get outgoing balances');
    }
    return response.data;
  },

  listSettlementRequests: async (
    eventId: string,
    cursor?: string,
    limit = 20
  ): Promise<PaginatedResponse<SettlementListItem>> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const response = await apiClient.get<{
      data: { items: SettlementListItem[]; pagination: { has_more: boolean; next_cursor?: string } };
    }>(`/v1/events/${eventId}/settlements/requests?${params.toString()}`);
    return {
      data: response.data.items,
      hasMore: response.data.pagination.has_more,
      nextCursor: response.data.pagination.next_cursor,
    };
  },

  getSettlementsHistory: async (
    eventId: string,
    cursor?: string,
    limit = 20
  ): Promise<PaginatedResponse<SettlementHistoryItem>> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const response = await apiClient.get<{
      data: { items: SettlementHistoryItem[]; pagination: { has_more: boolean; next_cursor?: string } };
    }>(`/v1/events/${eventId}/settlements/history?${params.toString()}`);
    return {
      data: response.data.items,
      hasMore: response.data.pagination.has_more,
      nextCursor: response.data.pagination.next_cursor,
    };
  },
};

export function incomingToActivityItem(item: IncomingBalanceItem): ActivityItem {
  return {
    id: `incoming-${item.user_id}`,
    type: 'expense',
    created_at: new Date().toISOString(),
    title: 'Incoming balance',
    amount_cents: item.amount_cents,
    paid_by: item.user_id,
    participant_count: 1,
  };
}

export function outgoingToActivityItem(item: OutgoingBalanceItem): ActivityItem {
  return {
    id: `outgoing-${item.user_id}`,
    type: 'expense',
    created_at: new Date().toISOString(),
    title: 'Outgoing balance',
    amount_cents: item.amount_cents,
    paid_by: item.user_id,
    participant_count: 1,
  };
}

export function settlementRequestToActivityItem(item: SettlementListItem): ActivityItem {
  return {
    id: item.id,
    type: 'settlement',
    created_at: item.created_at,
    amount_cents: item.amount_cents,
    from_user: item.from_user,
    to_user: item.to_user,
  };
}

export function historyToActivityItem(item: SettlementHistoryItem): ActivityItem {
  if (!item.is_outgoing) {
    return {
      id: item.id,
      type: 'honor_restored',
      created_at: item.created_at,
      amount_cents: item.amount_cents,
      from_user: item.counterparty_id,
      to_user: '__current_user__',
      approved_by: item.counterparty_id,
      reviewed_at: item.created_at,
    };
  }
  return {
    id: item.id,
    type: 'settlement',
    created_at: item.created_at,
    amount_cents: Math.abs(item.amount_cents),
    from_user: '__current_user__',
    to_user: item.counterparty_id,
  };
}
