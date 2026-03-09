type EnvMap = Record<string, string | undefined>;

function parseFlag(value: string | undefined, defaultValue = true): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  return defaultValue;
}

const env = import.meta.env as unknown as EnvMap;

export type FeatureFlags = {
  firstPlanGuide: boolean;
  nextBestActions: boolean;
  activationAnalytics: boolean;
};

const envDefaults: FeatureFlags = {
  firstPlanGuide: parseFlag(env.VITE_FEATURE_FIRST_PLAN_GUIDE, true),
  nextBestActions: parseFlag(env.VITE_FEATURE_NEXT_BEST_ACTIONS, true),
  activationAnalytics: parseFlag(env.VITE_FEATURE_ACTIVATION_ANALYTICS, true),
};

export const featureFlags: FeatureFlags = { ...envDefaults };

function applyRuntimeFeatureFlags(partial: Partial<FeatureFlags>): void {
  if (typeof partial.firstPlanGuide === 'boolean') {
    featureFlags.firstPlanGuide = partial.firstPlanGuide;
  }
  if (typeof partial.nextBestActions === 'boolean') {
    featureFlags.nextBestActions = partial.nextBestActions;
  }
  if (typeof partial.activationAnalytics === 'boolean') {
    featureFlags.activationAnalytics = partial.activationAnalytics;
  }
}

export async function bootstrapFeatureFlags(): Promise<void> {
  try {
    const response = await fetch('/api/feature-flags');
    if (!response.ok) return;
    const payload = await response.json();
    if (!payload?.success || typeof payload.flags !== 'object' || !payload.flags) return;
    applyRuntimeFeatureFlags(payload.flags as Partial<FeatureFlags>);
  } catch {
    // Keep env defaults when backend flags are unavailable.
  }
}
