/**
 * Central feature flags (Phase 0 — P0.2).
 * Env-driven, evaluated once at module load. Keep flags here, not scattered
 * across components, so the roadmap's flag surface stays auditable.
 *
 * VITE_LEGACY_PAGES: 'on'  → expose pre-Curve legacy routes for school/teacher
 *                            accounts (AdminPanel, TeacherPortal, etc.)
 *                    anything else → consumer cohort sees Curve product only.
 *
 * VITE_ANALYTICS_PROVIDER: 'inhouse' (default) | 'posthog' — decided in P0.4.
 */

export const flags = {
  legacyPages: import.meta.env.VITE_LEGACY_PAGES === 'on',
  analyticsProvider: (import.meta.env.VITE_ANALYTICS_PROVIDER ?? 'inhouse') as
    | 'inhouse'
    | 'posthog',
} as const;

export type FeatureFlags = typeof flags;
