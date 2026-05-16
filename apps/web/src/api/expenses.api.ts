import { apiClient } from './client';

// Types for expenses
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
  current_version?: ExpenseVersion;
}

export interface ExpenseListItem {
  id: string;
  event_id: string;
  created_by: string;
  created_at: string;
  current_version_id?: string;
  deleted_at?: string;
  version_number: number;
  title: string;
  description?: string;
  amount_cents: number;
  paid_by: string;
  split_type?: string;
  expense_type?: string;
  participant_ids?: string[];
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

// API calls
export const expensesApi = {
  // List expenses for an event
  list: async (
    eventId: string,
    userId: string,
    cursor?: string,
    limit = 20,
    includeDeleted = false
  ): Promise<{ data: ExpenseListItem[]; hasMore: boolean; nextCursor?: string }> => {
    const params = new URLSearchParams({
      limit: String(limit),
      include_deleted: String(includeDeleted),
      user_id: userId,
    });
    if (cursor) params.set('cursor', cursor);
    const response = await apiClient.get<{ data: { items: ExpenseListItem[]; pagination: { has_more: boolean; next_cursor?: string } } }>(
      `/v1/events/${eventId}/expenses?${params.toString()}`
    );
    return {
      data: response.data.items,
      hasMore: response.data.pagination.has_more,
      nextCursor: response.data.pagination.next_cursor,
    };
  },

  // Get a single expense
  get: async (eventId: string, expenseId: string): Promise<Expense> => {
    const response = await apiClient.get<{ success: boolean; data: Expense; error: unknown }>(`/v1/events/${eventId}/expenses/${expenseId}`);
    if (!response.success) {
      throw new Error(response.error as string || 'Failed to get expense');
    }
    return response.data;
  },

  // Create a new expense
  create: async (eventId: string, data: CreateExpenseRequest): Promise<Expense> => {
    const response = await apiClient.post<{ success: boolean; data: Expense; error: unknown }>(`/v1/events/${eventId}/expenses`, data);
    if (!response.success) {
      throw new Error(response.error as string || 'Failed to create expense');
    }
    return response.data;
  },

  // Update an expense
  update: async (eventId: string, expenseId: string, data: UpdateExpenseRequest): Promise<Expense> => {
    return apiClient.patch<Expense>(`/v1/events/${eventId}/expenses/${expenseId}`, data);
  },

  // Delete an expense
  delete: async (eventId: string, expenseId: string): Promise<void> => {
    return apiClient.delete<void>(`/v1/events/${eventId}/expenses/${expenseId}`);
  },

  // Get expense versions
  listVersions: async (eventId: string, expenseId: string): Promise<ExpenseVersionDetail[]> => {
    return apiClient.get<ExpenseVersionDetail[]>(`/v1/events/${eventId}/expenses/${expenseId}/versions`);
  },
};