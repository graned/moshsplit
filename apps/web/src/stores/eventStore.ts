import { create } from 'zustand';
import { groupsApi, Group, GroupMember } from '../api/groups.api';

interface EventState {
  currentEventId: string | null;
  currentEvent: Group | null;
  members: GroupMember[];
  isLoading: boolean;
  error: string | null;
  setCurrentEventId: (id: string | null) => void;
  fetchEvent: (eventId: string) => Promise<void>;
  fetchMembers: (eventId: string) => Promise<void>;
  refetch: () => Promise<void>;
  clear: () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  currentEventId: null,
  currentEvent: null,
  members: [],
  isLoading: false,
  error: null,

  setCurrentEventId: (id) => set({ currentEventId: id }),

  fetchEvent: async (eventId) => {
    set({ isLoading: true, error: null });
    try {
      const event = await groupsApi.get(eventId);
      set({ currentEvent: event, currentEventId: eventId, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch event';
      set({ error: message, isLoading: false });
    }
  },

  fetchMembers: async (eventId) => {
    try {
      const members = await groupsApi.listMembers(eventId);
      set({ members });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch members';
      set({ error: message });
    }
  },

  refetch: async () => {
    const eventId = get().currentEventId;
    if (!eventId) return;
    await Promise.all([get().fetchEvent(eventId), get().fetchMembers(eventId)]);
  },

  clear: () => set({ currentEventId: null, currentEvent: null, members: [], isLoading: false, error: null }),
}));
