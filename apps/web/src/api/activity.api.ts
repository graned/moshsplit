import { apiClient } from './client';

// ─── Activity Item Types ───────────────────────────────────────────────────

/** Base shape shared by all activity items */
export interface ActivityItemBase {
  id: string;
  event_id: string;
  created_at: string;
  actor_id: string;
}

/** Expense activity – an expense was created or updated */
export interface ExpenseActivity extends ActivityItemBase {
  type: 'expense_created' | 'expense_updated';
  expense_id: string;
  expense_title: string;
  expense_amount_cents: number;
  expense_type?: string;
  paid_by: string;
  participant_ids?: string[];
}

/** Settlement activity – a settlement was created or confirmed */
export interface SettlementActivity extends ActivityItemBase {
  type: 'settlement_created' | 'settlement_confirmed';
  settlement_id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  status: string;
}

/** Milestone activity – a user joined, event milestone, etc. */
export interface MilestoneActivity extends ActivityItemBase {
  type: 'member_joined' | 'event_milestone';
  title: string;
  description: string;
  target_user_id?: string;
}

/** Discriminated union of all activity item types */
export type ActivityItem =
  | ExpenseActivity
  | SettlementActivity
  | MilestoneActivity;

/** Helper type-guards */
export function isExpenseActivity(item: ActivityItem): item is ExpenseActivity {
  return item.type === 'expense_created' || item.type === 'expense_updated';
}

export function isSettlementActivity(item: ActivityItem): item is SettlementActivity {
  return item.type === 'settlement_created' || item.type === 'settlement_confirmed';
}

export function isMilestoneActivity(item: ActivityItem): item is MilestoneActivity {
  return item.type === 'member_joined' || item.type === 'event_milestone';
}

// ─── API Calls ─────────────────────────────────────────────────────────────

export const activityApi = {
  /**
   * List mixed activity items for an event.
   * Returns paginated results with cursor-based pagination.
   */
  list: async (
    eventId: string,
    userId: string,
    cursor?: string,
    limit = 20
  ): Promise<{ data: ActivityItem[]; hasMore: boolean; nextCursor?: string }> => {
    const params = new URLSearchParams({
      limit: String(limit),
      user_id: userId,
    });
    if (cursor) params.set('cursor', cursor);

    const response = await apiClient.get<{
      data: {
        items: ActivityItem[];
        pagination: { has_more: boolean; next_cursor?: string };
      };
    }>(`/v1/events/${eventId}/activity?${params.toString()}`);

    return {
      data: response.data.items,
      hasMore: response.data.pagination.has_more,
      nextCursor: response.data.pagination.next_cursor,
    };
  },
};
