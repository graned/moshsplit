import { apiClient } from './client';

// Types for groups (events)
export interface Group {
  id: string;
  name: string;
  description?: string;
  currency: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count: number;
}

export interface GroupListItem {
  id: string;
  name: string;
  currency: string;
  status: string;
  member_count: number;
  created_at: string;
}

export interface CreateGroupRequest {
  user_id: string;
  name: string;
  description?: string;
  currency?: string;
}

export interface UpdateGroupRequest {
  user_id: string;
  name?: string;
  description?: string;
  currency?: string;
  status?: string;
}

// Member types
export interface GroupMember {
  id: string;
  event_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  // Populated user info (joined separately)
  user_name?: string;
  user_email?: string;
}

export interface AddMemberRequest {
  user_id: string;
  role?: string;
}

// API calls
export const groupsApi = {
  // List all groups (events)
  list: async (userId: string, cursor?: string, limit = 20): Promise<{ data: GroupListItem[]; hasMore: boolean; nextCursor?: string }> => {
    const params = new URLSearchParams({ limit: String(limit), user_id: userId });
    if (cursor) params.set('cursor', cursor);
    const response = await apiClient.get<{ data: { items: GroupListItem[]; pagination: { has_more: boolean; next_cursor?: string } } }>(
      `/v1/events?${params.toString()}`
    );
    console.log('[groupsApi] list response:', JSON.stringify(response));
    return {
      data: response.data.items,
      hasMore: response.data.pagination.has_more,
      nextCursor: response.data.pagination.next_cursor,
    };
  },

  // Get a single group
  get: async (groupId: string): Promise<Group> => {
    return apiClient.get<Group>(`/v1/events/${groupId}`);
  },

  // Create a new group
  create: async (data: CreateGroupRequest): Promise<Group> => {
    console.log('[groupsApi] Creating group with data:', JSON.stringify(data));
    const result = await apiClient.post<{ success: boolean; data: Group; error: unknown }>('/v1/events', data);
    console.log('[groupsApi] Create group raw result:', JSON.stringify(result));
    if (!result.success) {
      throw new Error(result.error as string || 'Failed to create group');
    }
    console.log('[groupsApi] Create group returning:', result.data);
    return result.data;
  },

  // Update a group
  update: async (groupId: string, data: UpdateGroupRequest): Promise<Group> => {
    return apiClient.patch<Group>(`/v1/events/${groupId}`, data);
  },

  // Delete (archive) a group
  delete: async (groupId: string): Promise<void> => {
    return apiClient.delete<void>(`/v1/events/${groupId}`);
  },

  // List members of a group
  listMembers: async (groupId: string): Promise<GroupMember[]> => {
    const response = await apiClient.get<{ data: GroupMember[] } | GroupMember[]>(`/v1/events/${groupId}/members`);
    // Handle both wrapped and unwrapped responses
    if (Array.isArray(response)) {
      return response;
    }
    if (response && 'data' in response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  },

  // Add a member to a group
  addMember: async (groupId: string, data: AddMemberRequest): Promise<GroupMember> => {
    return apiClient.post<GroupMember>(`/v1/events/${groupId}/members`, data);
  },

  // Remove a member from a group
  removeMember: async (groupId: string, userId: string): Promise<void> => {
    return apiClient.delete<void>(`/v1/events/${groupId}/members/${userId}`);
  },
};