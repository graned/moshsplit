/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// SVG module declarations for ?react imports
declare module '*.svg?react' {
  import { ComponentType, SVGProps } from 'react';
  const content: ComponentType<SVGProps<SVGSVGElement>>;
  export default content;
}