/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_TOKEN: string;
  readonly VITE_SENTINEL_URL: string;
  readonly VITE_MOSHSPLIT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
