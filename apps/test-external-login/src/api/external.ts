declare global {
  interface Window {
    __SPIN_CONFIG__?: {
      VITE_API_TOKEN?: string;
      VITE_API_URL?: string;
      VITE_MOSHSPLIT_URL?: string;
      VITE_SENTINEL_URL?: string;
    };
  }
}

const getApiUrl = () => window.__SPIN_CONFIG__?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080';
const getApiToken = () => window.__SPIN_CONFIG__?.VITE_API_TOKEN || '';

export interface ExternalSummaryResponse {
  event_name: string;
  total_balance_cents: number;
  items: Array<{
    title: string;
    amount_cents: number;
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
}

export const externalApi = {
  getSummary: async (email: string): Promise<ExternalSummaryResponse> => {
    const response = await fetch(`${getApiUrl()}/v1/balances/external-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiToken()}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${response.status}: Failed to fetch summary`);
    }

    return response.json();
  },

  externalLogin: async (data: ExternalLoginRequest & { format?: string }): Promise<ExternalLoginResponse> => {
    const response = await fetch(`${getApiUrl()}/v1/auth/external-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiToken()}`,
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
