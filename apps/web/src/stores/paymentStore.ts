import { create } from 'zustand';
import { queryClient } from '../main';
import { paymentsApi, Payment, PaymentTransaction, CreatePaymentRequest } from '../api/payments.api';

interface PaymentState {
  isCreating: boolean;
  isProposing: boolean;
  isConfirming: boolean;
  error: string | null;
  createPayment: (eventId: string, data: CreatePaymentRequest) => Promise<Payment>;
  proposeTransaction: (eventId: string, paymentId: string, amountCents: number) => Promise<PaymentTransaction>;
  confirmTransaction: (eventId: string, transactionId: string) => Promise<PaymentTransaction>;
  clearError: () => void;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  isCreating: false,
  isProposing: false,
  isConfirming: false,
  error: null,

  createPayment: async (eventId, data) => {
    set({ isCreating: true, error: null });
    try {
      const result = await paymentsApi.create(eventId, data);
      queryClient.invalidateQueries({ queryKey: ['payments-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-breakdown', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      set({ isCreating: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create payment';
      set({ error: message, isCreating: false });
      throw err;
    }
  },

  proposeTransaction: async (eventId, paymentId, amountCents) => {
    set({ isProposing: true, error: null });
    try {
      const result = await paymentsApi.proposeTransaction(eventId, paymentId, amountCents);
      queryClient.invalidateQueries({ queryKey: ['payments-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-breakdown', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      set({ isProposing: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to propose transaction';
      set({ error: message, isProposing: false });
      throw err;
    }
  },

  confirmTransaction: async (eventId, transactionId) => {
    set({ isConfirming: true, error: null });
    try {
      const result = await paymentsApi.confirmTransaction(eventId, transactionId);
      queryClient.invalidateQueries({ queryKey: ['payments-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments-breakdown', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      set({ isConfirming: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm transaction';
      set({ error: message, isConfirming: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
