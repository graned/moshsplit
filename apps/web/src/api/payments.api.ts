import { apiClient } from './client';

export interface Payment {
  id: string;
  event_id: string;
  creditor_id: string;
  debtor_id: string;
  expense_id?: string;
  amount_cents: number;
  amount_paid_cents: number;
  reason: 'reimbursement' | 'expense' | 'settlement';
  status: 'open' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  payment_id: string;
  amount_cents: number;
  status: 'pending' | 'confirmed' | 'rejected';
  proposed_by: string;
  confirmed_by?: string;
  created_at: string;
  confirmed_at?: string;
}

export interface TransactionWithPaymentContext {
  id: string;
  payment_id: string;
  amount_cents: number;
  status: 'pending' | 'confirmed' | 'rejected';
  proposed_by: string;
  confirmed_by?: string;
  created_at: string;
  confirmed_at?: string;
  creditor_id: string;
  debtor_id: string;
  payment_amount_cents: number;
  payment_reason: string;
}

export interface BalanceSummary {
  net_balance: number;
  gross_balance: number;
}

export interface PaymentBreakdown {
  incoming: Payment[];
  outgoing: Payment[];
  total_incoming: number;
  total_outgoing: number;
  net_balance: number;
}

export interface CreatePaymentRequest {
  creditor_id: string;
  debtor_id: string;
  expense_id?: string;
  amount_cents: number;
  reason: string;
}

export interface ProposeTransactionRequest {
  amount_cents: number;
}

export const paymentsApi = {
  create: async (eventId: string, data: CreatePaymentRequest): Promise<Payment> => {
    const response = await apiClient.post<{ success: boolean; data: Payment; error: unknown }>(
      `/v1/events/${eventId}/payments`,
      data
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to create payment');
    }
    return response.data;
  },

  list: async (eventId: string): Promise<Payment[]> => {
    const response = await apiClient.get<{ success: boolean; data: { items: Payment[]; pagination: unknown }; error: unknown }>(
      `/v1/events/${eventId}/payments`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to list payments');
    }
    return response.data?.items ?? [];
  },

  get: async (eventId: string, paymentId: string): Promise<Payment> => {
    const response = await apiClient.get<{ success: boolean; data: Payment; error: unknown }>(
      `/v1/events/${eventId}/payments/${paymentId}`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get payment');
    }
    return response.data;
  },

  proposeTransaction: async (
    eventId: string,
    paymentId: string,
    amountCents: number
  ): Promise<PaymentTransaction> => {
    const response = await apiClient.post<{ success: boolean; data: PaymentTransaction; error: unknown }>(
      `/v1/events/${eventId}/payments/${paymentId}/transactions`,
      { amount_cents: amountCents }
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to propose transaction');
    }
    return response.data;
  },

  confirmTransaction: async (
    eventId: string,
    transactionId: string
  ): Promise<PaymentTransaction> => {
    const response = await apiClient.post<{ success: boolean; data: PaymentTransaction; error: unknown }>(
      `/v1/events/${eventId}/payments/transactions/${transactionId}/confirm`,
      {}
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to confirm transaction');
    }
    return response.data;
  },

  getIncoming: async (eventId: string): Promise<Payment[]> => {
    const response = await apiClient.get<{ success: boolean; data: Payment[]; error: unknown }>(
      `/v1/events/${eventId}/payments/incoming`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get incoming payments');
    }
    return response.data;
  },

  getOutgoing: async (eventId: string): Promise<Payment[]> => {
    const response = await apiClient.get<{ success: boolean; data: Payment[]; error: unknown }>(
      `/v1/events/${eventId}/payments/outgoing`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get outgoing payments');
    }
    return response.data;
  },

  getBalance: async (eventId: string): Promise<BalanceSummary> => {
    const response = await apiClient.get<{ success: boolean; data: BalanceSummary; error: unknown }>(
      `/v1/events/${eventId}/payments/balance`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get balance summary');
    }
    return response.data;
  },

  getBreakdown: async (eventId: string): Promise<PaymentBreakdown> => {
    const response = await apiClient.get<{ success: boolean; data: PaymentBreakdown; error: unknown }>(
      `/v1/events/${eventId}/payments/breakdown`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get payment breakdown');
    }
    return response.data;
  },

  getTransactions: async (eventId: string, paymentId: string): Promise<PaymentTransaction[]> => {
    const response = await apiClient.get<{ success: boolean; data: PaymentTransaction[]; error: unknown }>(
      `/v1/events/${eventId}/payments/${paymentId}/transactions`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get transactions');
    }
    return response.data;
  },

  getAllTransactions: async (eventId: string): Promise<TransactionWithPaymentContext[]> => {
    const response = await apiClient.get<{ success: boolean; data: TransactionWithPaymentContext[]; error: unknown }>(
      `/v1/events/${eventId}/payments/transactions`
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get all transactions');
    }
    return response.data;
  },

  rejectTransaction: async (eventId: string, transactionId: string): Promise<PaymentTransaction> => {
    const response = await apiClient.post<{ success: boolean; data: PaymentTransaction; error: unknown }>(
      `/v1/events/${eventId}/payments/transactions/${transactionId}/reject`,
      {}
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to reject transaction');
    }
    return response.data;
  },
};
