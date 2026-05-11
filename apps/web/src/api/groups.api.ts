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
    const response = await apiClient.get<{ data: GroupListItem[]; has_more: boolean; next_cursor?: string }>(
      `/v1/events?${params.toString()}`
    );
    return {
      data: response.data,
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  },

  // Get a single group
  get: async (groupId: string): Promise<Group> => {
    return apiClient.get<Group>(`/v1/events/${groupId}`);
  },

  // Create a new group
  create: async (data: CreateGroupRequest): Promise<Group> => {
    return apiClient.post<Group>('/v1/events', data);
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
    return apiClient.get<GroupMember[]>(`/v1/events/${groupId}/members`);
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