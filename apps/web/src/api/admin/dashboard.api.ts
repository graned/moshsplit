import { useAuthStore } from '@moshsplit/auth-react';

// Types for admin dashboard stats
export interface AdminStats {
  total_events: number;
  active_events: number;
  total_users: number;
  active_users: number;
  total_expenses: number;
  total_amount_cents: number;
  system_health: 'healthy' | 'degraded' | 'critical';
  uptime_seconds: number;
}

export interface RecentActivity {
  id: string;
  timestamp: string;
  action: string;
  actor_name?: string;
  resource_type: string;
  resource_id?: string;
  details: string;
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

export const adminDashboardApi = {
  getStats: async (): Promise<AdminStats> => {
    const response = await pitbossFetch('/v1/admin/stats');
    const result = await response.json();
    return result.data;
  },

  getRecentActivity: async (limit = 10): Promise<RecentActivity[]> => {
    const response = await pitbossFetch(`/v1/admin/activity?limit=${limit}`);
    const result = await response.json();
    return result.data?.items || [];
  },
};
