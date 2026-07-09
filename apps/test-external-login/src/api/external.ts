const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

export interface ExternalSummaryResponse {
  event_name: string;
  total_balance_cents: number;
  expenses: Array<{
    id: string;
    description: string;
    amount_cents: number;
    paid_by_email: string;
    created_at: string;
  }>;
}

export interface ExternalLoginRequest {
  api_token: string;
  email: string;
  display_name: string;
  avatar_url?: string;
}

export interface ExternalLoginResponse {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  email_verified: boolean;
}

export const externalApi = {
  getSummary: async (email: string): Promise<ExternalSummaryResponse> => {
    const response = await fetch(`${API_URL}/v1/balances/external-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${response.status}: Failed to fetch summary`);
    }

    return response.json();
  },

  externalLogin: async (data: ExternalLoginRequest): Promise<ExternalLoginResponse> => {
    const response = await fetch(`${API_URL}/v1/auth/external-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${response.status}: External login failed`);
    }

    return response.json();
  },
};
