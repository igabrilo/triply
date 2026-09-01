/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PROXY_TARGET: string;
  readonly VITE_OPENWEATHERMAP_API_KEY?: string;
  readonly VITE_FEATURE_FIRST_PLAN_GUIDE?: string;
  readonly VITE_FEATURE_NEXT_BEST_ACTIONS?: string;
  readonly VITE_FEATURE_ACTIVATION_ANALYTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
