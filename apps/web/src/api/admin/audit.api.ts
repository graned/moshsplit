import { useAuthStore } from '@moshsplit/auth-react';

// Types for audit log
export interface AuditEntry {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_name?: string;
  actor_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export interface AuditLogResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListAuditLogParams {
  page?: number;
  pageSize?: number;
  actor?: string;
  action?: string;
  resource_type?: string;
  from?: string;
  to?: string;
}

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

export const adminAuditApi = {
  list: async (params?: ListAuditLogParams): Promise<AuditLogResponse> => {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('page_size', String(params.pageSize));
    if (params?.actor) searchParams.set('actor', params.actor);
    if (params?.action) searchParams.set('action', params.action);
    if (params?.resource_type) searchParams.set('resource_type', params.resource_type);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);

    const response = await pitbossFetch(`/v1/admin/audit?${searchParams.toString()}`);
    const result = await response.json();

    const items = (result.data?.items || []).map((entry: any) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      actor_id: entry.actor_id,
      actor_name: entry.actor_name,
      actor_email: entry.actor_email,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
      details: entry.details || {},
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
    }));

    return {
      data: items,
      total: result.data?.total || items.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || 50,
      hasMore: result.data?.has_more || false,
    };
  },
};
