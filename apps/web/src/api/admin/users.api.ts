import { apiClient } from '../client';

// User types for admin management
export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'inactive' | 'suspended';

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

// Admin users API
export const adminUsersApi = {
  // List all users with pagination and filters
  list: async (params?: ListAdminUsersParams): Promise<AdminUsersListResponse> => {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('page_size', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.role) searchParams.set('role', params.role);

    const response = await apiClient.get<AdminUsersListResponse>(
      `/v1/admin/users?${searchParams.toString()}`
    );
    return response;
  },

  // Get a single user by ID
  get: async (userId: string): Promise<AdminUser> => {
    return apiClient.get<AdminUser>(`/v1/admin/users/${userId}`);
  },

  // Update user status (activate, deactivate, suspend)
  updateStatus: async (userId: string, data: UpdateUserStatusRequest): Promise<AdminUser> => {
    return apiClient.patch<AdminUser>(`/v1/admin/users/${userId}/status`, data);
  },

  // Update user role
  updateRole: async (userId: string, data: UpdateUserRoleRequest): Promise<AdminUser> => {
    return apiClient.patch<AdminUser>(`/v1/admin/users/${userId}/role`, data);
  },
};