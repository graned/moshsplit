import { Group, GroupMember } from './groups.api';
import { ExpenseListItem } from './expenses.api';

export const mockEvent: Group = {
  id: 'mock-event-1',
  name: 'Summer Festival 2026',
  description: 'Parque da Cidade, Porto',
  currency: 'EUR',
  status: 'active',
  created_by: 'user-1',
  created_at: '2026-06-15T10:00:00Z',
  updated_at: '2026-06-15T10:00:00Z',
  member_count: 5,
};

export const mockMembers: GroupMember[] = [
  { id: 'mem-1', event_id: 'mock-event-1', user_id: 'user-1', role: 'admin', joined_at: '2026-06-15T10:00:00Z', user_name: 'Rui', user_email: 'rui@example.com' },
  { id: 'mem-2', event_id: 'mock-event-1', user_id: 'user-2', role: 'member', joined_at: '2026-06-15T10:05:00Z', user_name: 'Ana', user_email: 'ana@example.com' },
  { id: 'mem-3', event_id: 'mock-event-1', user_id: 'user-3', role: 'member', joined_at: '2026-06-15T10:10:00Z', user_name: 'Carlos', user_email: 'carlos@example.com' },
  { id: 'mem-4', event_id: 'mock-event-1', user_id: 'user-4', role: 'member', joined_at: '2026-06-15T10:15:00Z', user_name: 'Marta', user_email: 'marta@example.com' },
  { id: 'mem-5', event_id: 'mock-event-1', user_id: 'user-5', role: 'member', joined_at: '2026-06-15T10:20:00Z', user_name: 'João', user_email: 'joao@example.com' },
];

export const mockExpenses: ExpenseListItem[] = [
  { id: 'exp-1', event_id: 'mock-event-1', created_by: 'user-1', created_at: '2026-06-20T14:00:00Z', current_version_id: 'v1', version_number: 1, title: 'Camping spot reservation', amount_cents: 35000, paid_by: 'user-1', split_type: 'equal' },
  { id: 'exp-2', event_id: 'mock-event-1', created_by: 'user-2', created_at: '2026-06-21T18:30:00Z', current_version_id: 'v1', version_number: 1, title: 'BBQ supplies', amount_cents: 8950, paid_by: 'user-2', split_type: 'equal' },
  { id: 'exp-3', event_id: 'mock-event-1', created_by: 'user-3', created_at: '2026-06-22T09:00:00Z', current_version_id: 'v1', version_number: 1, title: 'Gas station - round trip', amount_cents: 6540, paid_by: 'user-3', split_type: 'equal' },
  { id: 'exp-4', event_id: 'mock-event-1', created_by: 'user-1', created_at: '2026-06-22T12:00:00Z', current_version_id: 'v1', deleted_at: '2026-06-23T10:00:00Z', version_number: 1, title: 'Beer keg (paid)', amount_cents: 12000, paid_by: 'user-1', split_type: 'custom' },
  { id: 'exp-5', event_id: 'mock-event-1', created_by: 'user-4', created_at: '2026-06-22T20:00:00Z', current_version_id: 'v1', version_number: 1, title: 'Ice and drinks', amount_cents: 3200, paid_by: 'user-4', split_type: 'equal' },
  { id: 'exp-6', event_id: 'mock-event-1', created_by: 'user-5', created_at: '2026-06-23T08:00:00Z', current_version_id: 'v1', version_number: 1, title: 'Breakfast for everyone', amount_cents: 4500, paid_by: 'user-5', split_type: 'equal' },
  { id: 'exp-7', event_id: 'mock-event-1', created_by: 'user-2', created_at: '2026-06-23T11:30:00Z', current_version_id: 'v1', deleted_at: '2026-06-24T09:00:00Z', version_number: 1, title: 'Festival entry tickets', amount_cents: 75000, paid_by: 'user-2', split_type: 'shares' },
  { id: 'exp-8', event_id: 'mock-event-1', created_by: 'user-3', created_at: '2026-06-23T15:00:00Z', current_version_id: 'v1', version_number: 1, title: 'Merchandise - t-shirts', amount_cents: 8000, paid_by: 'user-3', split_type: 'custom' },
  { id: 'exp-9', event_id: 'mock-event-1', created_by: 'user-1', created_at: '2026-06-24T10:00:00Z', current_version_id: 'v1', version_number: 1, title: 'Late night pizza delivery', amount_cents: 2800, paid_by: 'user-1', split_type: 'equal' },
  { id: 'exp-10', event_id: 'mock-event-1', created_by: 'user-4', created_at: '2026-06-24T13:00:00Z', current_version_id: 'v1', version_number: 1, title: 'Uber to the beach', amount_cents: 1800, paid_by: 'user-4', split_type: 'equal' },
  { id: 'exp-11', event_id: 'mock-event-1', created_by: 'user-5', created_at: '2026-06-24T16:00:00Z', current_version_id: 'v1', deleted_at: '2026-06-25T08:00:00Z', version_number: 1, title: 'Sunset boat trip', amount_cents: 22000, paid_by: 'user-5', split_type: 'equal' },
  { id: 'exp-12', event_id: 'mock-event-1', created_by: 'user-2', created_at: '2026-06-25T09:30:00Z', current_version_id: 'v1', version_number: 1, title: 'Cleanup supplies', amount_cents: 1560, paid_by: 'user-2', split_type: 'percentage' },
];

export const mockUserId = 'user-1';
