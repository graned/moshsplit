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
    const response = await apiClient.get<{ data: ExpenseListItem[]; has_more: boolean; next_cursor?: string }>(
      `/v1/events/${eventId}/expenses?${params.toString()}`
    );
    return {
      data: response.data,
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  },

  // Get a single expense
  get: async (eventId: string, expenseId: string): Promise<Expense> => {
    return apiClient.get<Expense>(`/v1/events/${eventId}/expenses/${expenseId}`);
  },

  // Create a new expense
  create: async (eventId: string, data: CreateExpenseRequest): Promise<Expense> => {
    return apiClient.post<Expense>(`/v1/events/${eventId}/expenses`, data);
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