import { useAuthStore } from '@moshsplit/auth-react';

// Types for CSV import
export interface ImportResult {
  success: boolean;
  imported_count: number;
  failed_count: number;
  errors: string[];
  survivors: {
    id: string;
    email: string;
    name: string;
    status: 'created' | 'invited' | 'already_exists';
  }[];
}

export interface ImportStats {
  total_imports: number;
  total_survivors_summoned: number;
  last_import_at?: string;
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

export const adminImportApi = {
  importCsv: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = useAuthStore.getState().accessToken;
    const response = await fetch(`${PITBOSS_URL}/v1/admin/import/survivors`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Import failed' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  },

  getStats: async (): Promise<ImportStats> => {
    const response = await pitbossFetch('/v1/admin/import/stats');
    const result = await response.json();
    return result.data;
  },
};
