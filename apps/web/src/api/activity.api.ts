import { apiClient } from './client';

// ─── Activity Item Types ───────────────────────────────────────────────────

/** Base shape shared by all activity items */
export interface ActivityItemBase {
  id: string;
  created_at: string;
}

/** Expense activity – an expense was created */
export interface ExpenseActivity extends ActivityItemBase {
  type: 'expense';
  title: string;
  amount_cents: number;
  paid_by: string;
  participant_count: number;
  expense_type?: string;
}

/** Settlement activity – a payment between users */
export interface SettlementActivity extends ActivityItemBase {
  type: 'settlement';
  amount_cents: number;
  from_user: string;
  to_user: string;
}

/** Member join activity – a user joined the event */
export interface MemberJoinActivity extends ActivityItemBase {
  type: 'member_join';
  user_id: string;
}

/** Discriminated union of all activity item types */
export type ActivityItem = ExpenseActivity | SettlementActivity | MemberJoinActivity;

/** Helper type-guards */
export function isExpenseActivity(item: ActivityItem): item is ExpenseActivity {
  return item.type === 'expense';
}

export function isSettlementActivity(item: ActivityItem): item is SettlementActivity {
  return item.type === 'settlement';
}

export function isMemberJoinActivity(item: ActivityItem): item is MemberJoinActivity {
  return item.type === 'member_join';
}

// ─── API Calls ─────────────────────────────────────────────────────────────

export const activityApi = {
  /**
   * List mixed activity items for an event.
   * Returns paginated results with cursor-based pagination.
   */
  list: async (
    eventId: string,
    _userId: string,
    cursor?: string,
    limit = 20
  ): Promise<{ data: ActivityItem[]; hasMore: boolean; nextCursor?: string }> => {
    const params = new URLSearchParams({
      limit: String(limit),
    });
    if (cursor) params.set('cursor', cursor);

    const response = await apiClient.get<{
      data: {
        items: ActivityItem[];
        has_more: boolean;
        next_cursor?: string;
      };
    }>(`/v1/events/${eventId}/activity?${params.toString()}`);

    return {
      data: response.data.items,
      hasMore: response.data.has_more,
      nextCursor: response.data.next_cursor,
    };
  },
};
