import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_URL = process.env.VITE_API_URL || 'http://localhost:8080';
const API_TOKEN = process.env.VITE_API_TOKEN || '';
const MOSHSPLIT_URL = process.env.VITE_MOSHSPLIT_URL || 'http://moshsplit.localhost';

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5174,
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      'test-external-login.localhost',
    ],
    proxy: {
      '/v1': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(API_URL),
    'import.meta.env.VITE_API_TOKEN': JSON.stringify(API_TOKEN),
    'import.meta.env.VITE_MOSHSPLIT_URL': JSON.stringify(MOSHSPLIT_URL),
  },
});
