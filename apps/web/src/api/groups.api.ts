import { apiClient } from './client';

// Types for groups (events)
export interface EventImage {
  id: string;
  url: string;
  alt_text?: string;
  image_type: 'banner' | 'gallery';
  sort_order: number;
  uploaded_at: string;
}

export interface EventImages {
  banner?: EventImage;
  gallery: EventImage[];
}

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
  images?: EventImages;
}

export interface GroupListItem {
  id: string;
  name: string;
  description?: string;
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
  list: async (
    userId: string,
    cursor?: string,
    limit = 20,
    status?: string
  ): Promise<{ data: GroupListItem[]; hasMore: boolean; nextCursor?: string }> => {
    const params = new URLSearchParams({ limit: String(limit), user_id: userId });
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    const response = await apiClient.get<{
      data: { items: GroupListItem[]; pagination: { has_more: boolean; next_cursor?: string } };
    }>(`/v1/events?${params.toString()}`);
    
    return {
      data: response.data.items,
      hasMore: response.data.pagination.has_more,
      nextCursor: response.data.pagination.next_cursor,
    };
  },

  // Get a single group
  get: async (groupId: string): Promise<Group> => {
    const response = await apiClient.get<{ success: boolean; data: Group; error: unknown }>(`/v1/events/${groupId}`);
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to get group');
    }
    return response.data;
  },

  // Create a new group
  create: async (data: CreateGroupRequest): Promise<Group> => {
    
    const result = await apiClient.post<{ success: boolean; data: Group; error: unknown }>('/v1/events', data);
    
    if (!result.success) {
      throw new Error((result.error as string) || 'Failed to create group');
    }
    
    return result.data;
  },

  // Update a group (can be used to restore archived events by setting status to 'active')
  update: async (groupId: string, data: UpdateGroupRequest): Promise<Group> => {
    const response = await apiClient.patch<{ success: boolean; data: Group; error: unknown }>(
      `/v1/events/${groupId}`,
      data
    );
    if (!response.success) {
      throw new Error((response.error as string) || 'Failed to update group');
    }
    return response.data;
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

  // Image management
  listImages: async (groupId: string): Promise<EventImages> => {
    return apiClient.get<EventImages>(`/v1/events/${groupId}/images`);
  },

  addImage: async (
    groupId: string,
    data: { url: string; alt_text?: string; image_type: 'banner' | 'gallery'; sort_order?: number }
  ): Promise<EventImage> => {
    return apiClient.post<EventImage>(`/v1/events/${groupId}/images`, data);
  },

  updateImage: async (
    groupId: string,
    imageId: string,
    data: { alt_text?: string; sort_order?: number }
  ): Promise<EventImage> => {
    return apiClient.patch<EventImage>(`/v1/events/${groupId}/images/${imageId}`, data);
  },

  deleteImage: async (groupId: string, imageId: string): Promise<void> => {
    return apiClient.delete<void>(`/v1/events/${groupId}/images/${imageId}`);
  },
};
