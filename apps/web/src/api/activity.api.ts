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
  deleted_at?: string;
  deletion_status?: string;
}

/** Settlement activity – a payment between users (pending) */
export interface SettlementActivity extends ActivityItemBase {
  type: 'settlement';
  amount_cents: number;
  from_user: string;
  to_user: string;
}

/** Honor Restored activity – a settlement was approved */
export interface HonorRestoredActivity extends ActivityItemBase {
  type: 'honor_restored';
  amount_cents: number;
  from_user: string;
  to_user: string;
  approved_by: string;
  reviewed_at: string;
}

/** Member join activity – a user joined the event */
export interface MemberJoinActivity extends ActivityItemBase {
  type: 'member_join';
  user_id: string;
  user_name?: string;
}

/** Expense updated activity – an expense was modified (new version) */
export interface ExpenseUpdatedActivity extends ActivityItemBase {
  type: 'expense_updated';
  expense_id: string;
  title: string;
  amount_cents: number;
  paid_by: string;
  participant_count: number;
  expense_type?: string;
}

/** Settlement rejected activity – a settlement request was rejected */
export interface SettlementRejectedActivity extends ActivityItemBase {
  type: 'settlement_rejected';
  amount_cents: number;
  from_user: string;
  to_user: string;
  approved_by: string;
  reviewed_at: string;
}

/** Expense deleted activity – an expense was deleted */
export interface ExpenseDeletedActivity extends ActivityItemBase {
  type: 'expense_deleted';
  expense_id: string;
  title: string;
  amount_cents: number;
  paid_by: string;
}

/** Reimbursement activity – created when an expense is deleted, showing debt transfer */
export interface ReimbursementActivity extends ActivityItemBase {
  type: 'reimbursement';
  ref_expense_id: string;
  settlement_id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  original_expense_title: string;
}

/** Discriminated union of all activity item types */
export type ActivityItem = ExpenseActivity | SettlementActivity | HonorRestoredActivity | MemberJoinActivity | ExpenseUpdatedActivity | SettlementRejectedActivity | ExpenseDeletedActivity | ReimbursementActivity;

/** Helper type-guards */
export function isExpenseActivity(item: ActivityItem): item is ExpenseActivity {
  return item.type === 'expense';
}

export function isSettlementActivity(item: ActivityItem): item is SettlementActivity {
  return item.type === 'settlement';
}

export function isHonorRestoredActivity(item: ActivityItem): item is HonorRestoredActivity {
  return item.type === 'honor_restored';
}

export function isMemberJoinActivity(item: ActivityItem): item is MemberJoinActivity {
  return item.type === 'member_join';
}

export function isExpenseUpdatedActivity(item: ActivityItem): item is ExpenseUpdatedActivity {
  return item.type === 'expense_updated';
}

export function isSettlementRejectedActivity(item: ActivityItem): item is SettlementRejectedActivity {
  return item.type === 'settlement_rejected';
}

export function isExpenseDeletedActivity(item: ActivityItem): item is ExpenseDeletedActivity {
  return item.type === 'expense_deleted';
}

export function isReimbursementActivity(item: ActivityItem): item is ReimbursementActivity {
  return item.type === 'reimbursement';
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
