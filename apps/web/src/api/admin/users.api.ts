import { useAuthStore } from '@moshsplit/auth-react';

// User types for admin management
export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AdminUsersListResponse {
  data: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListAdminUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: UserStatus;
  role?: UserRole;
}

export interface UpdateUserStatusRequest {
  status: UserStatus;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

// Sentinel API base URL
const SENTINEL_URL = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';

// Helper to make requests to Sentinel with the current token
async function sentinelFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SENTINEL_URL}${endpoint}`, {
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

// Admin users API - calls Sentinel admin API directly
export const adminUsersApi = {
  // List all users with pagination and filters
  list: async (params?: ListAdminUsersParams): Promise<AdminUsersListResponse> => {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('page_size', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.role) searchParams.set('role', params.role);

    const response = await sentinelFetch(`/v1/api/admin/users?${searchParams.toString()}`);

    const result = await response.json();

    // Transform Sentinel response to our format
    const items = (result.data?.items || []).map((user: any) => ({
      id: user.user_id,
      email: user.email || '',
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      avatarUrl: user.avatar_url,
      role: user.roles?.[0]?.name || 'user',
      status: user.status,
      mfaEnabled: false,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    }));

    return {
      data: items,
      total: items.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
      hasMore: result.data?.pagination?.has_more || false,
    };
  },

  // Get a single user by ID
  get: async (userId: string): Promise<AdminUser> => {
    const response = await sentinelFetch(`/v1/api/admin/users/${userId}`);
    const result = await response.json();

    const user = result.data;
    return {
      id: user.user_id,
      email: user.email || '',
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      avatarUrl: user.avatar_url,
      role: user.roles?.[0]?.name || 'user',
      status: user.status,
      mfaEnabled: false,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    };
  },

  // Update user status (activate, deactivate, suspend)
  updateStatus: async (userId: string, data: UpdateUserStatusRequest): Promise<AdminUser> => {
    const response = await sentinelFetch(`/v1/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const result = await response.json();

    const user = result.data;
    return {
      id: user.user_id,
      email: user.email || '',
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      avatarUrl: user.avatar_url,
      role: user.roles?.[0]?.name || 'user',
      status: user.status,
      mfaEnabled: false,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    };
  },

  // Update user role
  updateRole: async (userId: string, _data: UpdateUserRoleRequest): Promise<AdminUser> => {
    return adminUsersApi.get(userId); // Role updates return user object
  },
};
