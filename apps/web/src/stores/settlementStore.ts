import { create } from 'zustand';
import { queryClient } from '../main';
import { settlementsApi, Settlement, CreateSettlementRequest } from '../api/settlements.api';

interface SettlementState {
  isCreating: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  isWithdrawing: boolean;
  error: string | null;
  createSettlement: (eventId: string, data: CreateSettlementRequest) => Promise<Settlement>;
  approveSettlement: (eventId: string, settlementId: string) => Promise<Settlement>;
  rejectSettlement: (eventId: string, settlementId: string, note?: string) => Promise<Settlement>;
  withdrawSettlement: (eventId: string, settlementId: string) => Promise<Settlement>;
  clearError: () => void;
}

export const useSettlementStore = create<SettlementState>((set) => ({
  isCreating: false,
  isApproving: false,
  isRejecting: false,
  isWithdrawing: false,
  error: null,

  createSettlement: async (eventId, data) => {
    set({ isCreating: true, error: null });
    try {
      const result = await settlementsApi.create(eventId, data);
      queryClient.invalidateQueries({ queryKey: ['settlements-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-count', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      set({ isCreating: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create settlement';
      set({ error: message, isCreating: false });
      throw err;
    }
  },

  approveSettlement: async (eventId, settlementId) => {
    set({ isApproving: true, error: null });
    try {
      const result = await settlementsApi.approve(eventId, settlementId);
      queryClient.invalidateQueries({ queryKey: ['settlements-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-count', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-drawer', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      set({ isApproving: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve settlement';
      set({ error: message, isApproving: false });
      throw err;
    }
  },

  withdrawSettlement: async (eventId, settlementId) => {
    set({ isWithdrawing: true, error: null });
    try {
      const result = await settlementsApi.withdraw(eventId, settlementId);
      queryClient.invalidateQueries({ queryKey: ['settlements-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-count', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-drawer', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      set({ isWithdrawing: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to withdraw settlement';
      set({ error: message, isWithdrawing: false });
      throw err;
    }
  },

  rejectSettlement: async (eventId, settlementId, note) => {
    set({ isRejecting: true, error: null });
    try {
      const result = await settlementsApi.reject(eventId, settlementId, note);
      queryClient.invalidateQueries({ queryKey: ['settlements-incoming', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-outgoing', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-count', eventId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-requests-drawer', eventId] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['explain-balance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['user-balance', eventId] });
      set({ isRejecting: false });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject settlement';
      set({ error: message, isRejecting: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
