import { create } from 'zustand';
import { queryClient } from '../main';
import { expensesApi, Expense, CreateExpenseRequest, UpdateExpenseRequest } from '../api/expenses.api';

interface ExpenseState {
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  createExpense: (eventId: string, data: CreateExpenseRequest) => Promise<Expense>;
  updateExpense: (eventId: string, expenseId: string, data: UpdateExpenseRequest) => Promise<Expense>;
  deleteExpense: (eventId: string, expenseId: string) => Promise<void>;
  clearError: () => void;
}

export const useExpenseStore = create<ExpenseState>((set) => ({
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,

  createExpense: async (eventId, data) => {
    set({ isCreating: true, error: null });
    try {
      const result = await expensesApi.create(eventId, data);
      queryClient.invalidateQueries({ queryKey: ['expenses-infinite', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-count', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-stats', eventId] });
      set({ isCreating: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create expense';
      set({ error: message, isCreating: false });
      throw err;
    }
  },

  updateExpense: async (eventId, expenseId, data) => {
    set({ isUpdating: true, error: null });
    try {
      const result = await expensesApi.update(eventId, expenseId, data);
      queryClient.invalidateQueries({ queryKey: ['expenses-infinite', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-count', eventId] });
      set({ isUpdating: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update expense';
      set({ error: message, isUpdating: false });
      throw err;
    }
  },

  deleteExpense: async (eventId, expenseId) => {
    set({ isDeleting: true, error: null });
    try {
      await expensesApi.delete(eventId, expenseId);
      queryClient.invalidateQueries({ queryKey: ['expenses-infinite', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-count', eventId] });
      set({ isDeleting: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete expense';
      set({ error: message, isDeleting: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
