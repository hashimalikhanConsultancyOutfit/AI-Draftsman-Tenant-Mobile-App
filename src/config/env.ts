import Constants from 'expo-constants';

export type AppEnv = 'development' | 'staging' | 'production';

const appEnv: AppEnv =
  (Constants.expoConfig?.extra?.appEnv as AppEnv | undefined) ?? 'development';

/**
 * API base URLs. Confirmed against the live OpenAPI spec at
 * https://be-api.aidraftsman.ai/api-json (239 paths, global prefix
 * `api/v1`). Staging/dev URLs are placeholders until confirmed —
 * see analysis doc conflicts-and-risks.md.
 */
const API_BASE_URLS: Record<AppEnv, string> = {
  development: 'https://be-api.aidraftsman.ai/api/v1',
  staging: 'https://be-api.aidraftsman.ai/api/v1',
  production: 'https://be-api.aidraftsman.ai/api/v1',
};

export const env = {
  appEnv,
  apiBaseUrl: API_BASE_URLS[appEnv],
  apiOrigin: 'https://be-api.aidraftsman.ai',
  isDev: appEnv === 'development',
} as const;
