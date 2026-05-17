import { apiClient } from './client';

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
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_note?: string;
}

export interface CreateSettlementRequest {
  from_user: string;
  to_user: string;
  amount_cents: number;
  note?: string;
  proof_url?: string;
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
};
