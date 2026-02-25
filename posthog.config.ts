/**
 * PostHog analytics configuration for UNICHAN-MVP.
 * Set POSTHOG_PROJECT_KEY_DESKTOP in .env for production.
 */
export const POSTHOG_PROJECT_KEY_DESKTOP =
  import.meta.env?.VITE_POSTHOG_PROJECT_KEY ?? 'phc_placeholder_disable_in_dev'

export const DEFAULT_POSTHOG_CONFIG = {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: true,
}
