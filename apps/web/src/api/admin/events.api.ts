import { useAuthStore } from '@moshsplit/auth-react';

// Types for admin event management
export interface AdminEvent {
  id: string;
  name: string;
  description?: string;
  currency: string;
  status: 'active' | 'archived' | 'deleted';
  created_by: string;
  creator_name?: string;
  member_count: number;
  expense_count: number;
  total_amount_cents: number;
  created_at: string;
  updated_at: string;
}

export interface AdminEventsListResponse {
  data: AdminEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListAdminEventsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

// Pitboss API base URL
const PITBOSS_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function pitbossFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${PITBOSS_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return response;
}

export const adminEventsApi = {
  list: async (params?: ListAdminEventsParams): Promise<AdminEventsListResponse> => {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('page_size', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);

    const response = await pitbossFetch(`/v1/admin/events?${searchParams.toString()}`);
    const result = await response.json();

    const items = (result.data?.items || []).map((event: any) => ({
      id: event.id,
      name: event.name,
      description: event.description,
      currency: event.currency || 'BRL',
      status: event.status || 'active',
      created_by: event.created_by,
      creator_name: event.creator_name,
      member_count: event.member_count || 0,
      expense_count: event.expense_count || 0,
      total_amount_cents: event.total_amount_cents || 0,
      created_at: event.created_at,
      updated_at: event.updated_at,
    }));

    return {
      data: items,
      total: result.data?.total || items.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
      hasMore: result.data?.has_more || false,
    };
  },

  summonEvent: async (data: { name: string; description?: string; currency?: string }): Promise<AdminEvent> => {
    const response = await pitbossFetch('/v1/admin/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.data;
  },

  restoreEvent: async (eventId: string): Promise<AdminEvent> => {
    const response = await pitbossFetch(`/v1/admin/events/${eventId}/restore`, {
      method: 'POST',
    });
    const result = await response.json();
    return result.data;
  },
};
