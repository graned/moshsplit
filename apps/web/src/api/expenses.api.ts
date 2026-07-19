import { apiClient } from './client';

export interface ExpenseVersion {
  id: string;
  expense_id: string;
  version_number: number;
  title: string;
  description?: string;
  amount_cents: number;
  paid_by: string;
  split_type: string;
  split_data: Record<string, unknown>;
  notes?: string;
  created_by: string;
  created_at: string;
  shares: ExpenseVersionShare[];
}

export interface ExpenseVersionShare {
  user_id: string;
  share_cents: number;
}

export interface ExpenseVersionDetail extends ExpenseVersion {
  shares: ExpenseVersionShare[];
}

export interface Expense {
  id: string;
  event_id: string;
  created_by: string;
  created_at: string;
  current_version_id?: string;
  deleted_at?: string;
  deletion_status?: string;
  current_version?: ExpenseVersion;
}

export interface ExpenseListItem {
  id: string;
  event_id: string;
  created_by: string;
  created_at: string;
  current_version_id?: string;
  deleted_at?: string;
  deletion_status?: string;
  version_number: number;
  title: string;
  description?: string;
  amount_cents: number;
  paid_by: string;
  split_type?: string;
  expense_type?: string;
  participant_ids?: string[];
  notes?: string;
}

export interface CreateExpenseRequest {
  user_id: string;
  title: string;
  description?: string;
  amount_cents: number;
  paid_by: string;
  split_type: string;
  split_data: Record<string, unknown>;
  notes?: string;
  expense_type?: string;
}

export interface UpdateExpenseRequest {
  user_id: string;
  title?: string;
  description?: string;
  amount_cents: number;
  paid_by: string;
  split_type: string;
  split_data: Record<string, unknown>;
  notes?: string;
  expense_type?: string;
}

export interface OpenPaymentInfo {
  payment_id: string;
  creditor_id: string;
  debtor_id: string;
  amount_cents: number;
  reason: string;
}

export interface DeletionRequiresChoiceResponse {
  expense_id: string;
  requires_choice: boolean;
  open_payments: OpenPaymentInfo[];
  total_cents: number;
}

export interface ClaimReimbursementRequest {
  payment_id: string;
  choice: 'credit' | 'payment';
}

export const expensesApi = {
  list: async (
    eventId: string,
    userId: string,
    cursor?: string,
    limit = 20,
    includeDeleted = false,
    expenseType?: string
  ): Promise<{ data: ExpenseListItem[]; hasMore: boolean; nextCursor?: string }> => {
    const params = new URLSearchParams({
      limit: String(limit),
      include_deleted: String(includeDeleted),
      user_id: userId,
    });
    if (cursor) params.set('cursor', cursor);
    if (expenseType) params.set('expense_type', expenseType);
    const response = await apiClient.get<{
      data: { items: ExpenseListItem[]; pagination: { has_more: boolean; next_cursor?: string } };
    }>(`/v1/events/${eventId}/expenses?${params.toString()}`);
    return {
      data: response.data.items,
      hasMore: response.data.pagination.has_more,
      nextCursor: response.data.pagination.next_cursor,
    };
  },

  get: async (eventId: string, expenseId: string): Promise<Expense> => {
    const response = await apiClient.get<{ success: boolean; data: Expense; error: unknown }>(
      `/v1/events/${eventId}/expenses/${expenseId}`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get expense');
    }
    return response.data;
  },

  create: async (eventId: string, data: CreateExpenseRequest): Promise<Expense> => {
    const response = await apiClient.post<{ success: boolean; data: Expense; error: unknown }>(
      `/v1/events/${eventId}/expenses`,
      data
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to create expense');
    }
    return response.data;
  },

  update: async (eventId: string, expenseId: string, data: UpdateExpenseRequest): Promise<Expense> => {
    return apiClient.patch<Expense>(`/v1/events/${eventId}/expenses/${expenseId}`, data);
  },

  delete: async (
    eventId: string,
    expenseId: string
  ): Promise<DeletionRequiresChoiceResponse | null> => {
    const response = await fetch(
      `${(apiClient as unknown as { baseUrl: string }).baseUrl}/v1/events/${eventId}/expenses/${expenseId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(apiClient.getToken() ? { Authorization: `Bearer ${apiClient.getToken()}` } : {}),
        },
      }
    );
    if (response.status === 204) return null;
    if (response.ok) {
      const envelope = await response.json();
      return envelope.data as DeletionRequiresChoiceResponse;
    }
    const body = await response.json().catch(() => ({}));
    throw { message: body.message || 'Failed to delete expense', status: response.status, ...body };
  },

  claimReimbursement: async (
    eventId: string,
    expenseId: string,
    data: ClaimReimbursementRequest
  ): Promise<void> => {
    await apiClient.post(`/v1/events/${eventId}/expenses/${expenseId}/claim-reimbursement`, data);
  },

  cancelPendingDeletion: async (eventId: string, expenseId: string): Promise<void> => {
    await apiClient.post(`/v1/events/${eventId}/expenses/${expenseId}/cancel-deletion`);
  },

  listVersions: async (eventId: string, expenseId: string): Promise<ExpenseVersionDetail[]> => {
    return apiClient.get<ExpenseVersionDetail[]>(`/v1/events/${eventId}/expenses/${expenseId}/versions`);
  },
};
