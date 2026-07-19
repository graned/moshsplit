import { apiClient } from './client';

export interface Credit {
  id: string;
  event_id: string;
  creditor_id: string;
  debtor_id: string;
  amount_cents: number;
  amount_used_cents: number;
  source_expense_id?: string;
  status: string;
  version: number;
  parent_credit_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditSummary {
  debtor_id: string;
  creditor_id: string;
  total_available_cents: number;
}

export interface CreateCreditRequest {
  creditor_id: string;
  debtor_id: string;
  amount_cents: number;
  source_expense_id?: string;
}

export interface ConvertCreditRequest {
  user_id: string;
}

export const creditsApi = {
  list: async (
    eventId: string,
    debtorId: string,
    creditorId: string
  ): Promise<Credit[]> => {
    const params = new URLSearchParams({
      debtor_id: debtorId,
      creditor_id: creditorId,
    });
    const response = await apiClient.get<{ success: boolean; data: Credit[]; error: unknown }>(
      `/v1/events/${eventId}/credits?${params.toString()}`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to list credits');
    }
    return response.data;
  },

  getSummary: async (
    eventId: string,
    debtorId: string,
    creditorId: string
  ): Promise<CreditSummary> => {
    const params = new URLSearchParams({
      debtor_id: debtorId,
      creditor_id: creditorId,
    });
    const response = await apiClient.get<{ success: boolean; data: CreditSummary; error: unknown }>(
      `/v1/events/${eventId}/credits/summary?${params.toString()}`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get credit summary');
    }
    return response.data;
  },

  create: async (eventId: string, data: CreateCreditRequest): Promise<Credit> => {
    const response = await apiClient.post<{ success: boolean; data: Credit; error: unknown }>(
      `/v1/events/${eventId}/credits`,
      data
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to create credit');
    }
    return response.data;
  },

  convert: async (
    eventId: string,
    creditId: string,
    data: ConvertCreditRequest
  ): Promise<Credit> => {
    const response = await apiClient.post<{ success: boolean; data: Credit; error: unknown }>(
      `/v1/events/${eventId}/credits/${creditId}/convert`,
      data
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to convert credit');
    }
    return response.data;
  },
};
