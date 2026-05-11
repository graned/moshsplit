export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000';

export const API_ENDPOINTS = {
  auth: {
    login: '/api/v1/auth/login',
    logout: '/api/v1/auth/logout',
    currentUser: '/api/v1/auth/me',
    forgotPassword: '/api/v1/auth/forgot-password',
    resetPassword: '/api/v1/auth/reset-password',
  },
  users: {
    profile: '/api/v1/users/profile',
    updateProfile: '/api/v1/users/profile',
  },
  settings: {
    security: '/api/v1/settings/security',
    mfa: '/api/v1/settings/mfa',
    changePassword: '/api/v1/settings/password',
  },
} as const;