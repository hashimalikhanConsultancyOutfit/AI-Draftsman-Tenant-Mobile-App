import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * App config is a function so it can read env vars at build/start time
 * (APP_ENV selects which API base URL and bundle identifier suffix to use).
 * See src/config/env.ts for the matching runtime reader.
 */
const APP_ENV = (process.env.APP_ENV ?? 'development') as
  | 'development'
  | 'staging'
  | 'production';

const IS_DEV = APP_ENV === 'development';
const IS_STAGING = APP_ENV === 'staging';

const bundleSuffix = IS_DEV ? '.dev' : IS_STAGING ? '.staging' : '';
// Always the same visible app name regardless of environment — the bundle
// identifier / package suffix above is what actually keeps dev, staging,
// and production installable side by side on one device; the name itself
// no longer carries an "(Dev)"/"(Staging)" suffix per request.
const appName = 'AI Draftsman B2B';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName,
  slug: 'ai-draftsman-tenant-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic', // driven by our own ThemeProvider, not the OS switch alone
  scheme: 'aidraftsmantenant',
  newArchEnabled: true,
  jsEngine: 'hermes',
  primaryColor: '#C8622A',
  backgroundColor: '#F4F2EE',

  // We render our own animated JS splash screen (see src/app/SplashGate.tsx).
  // The native splash below is only the instant-launch frame shown before JS boots.
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F4F2EE',
    dark: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#1C1A16',
    },
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: `ai.aidraftsman.tenant${bundleSuffix}`,
    infoPlist: {
      NSFaceIDUsageDescription:
        'Use Face ID to unlock AI Draftsman B2B quickly and securely.',
      LSApplicationQueriesSchemes: ['googleauthenticator', 'otpauth'],
    },
  },

  android: {
    package: `ai.aidraftsman.tenant${bundleSuffix}`,
    adaptiveIcon: {
      backgroundColor: '#F4F2EE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['USE_BIOMETRIC', 'USE_FINGERPRINT'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'aidraftsmantenant' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  web: {
    favicon: './assets/favicon.png',
  },

  plugins: [
    'expo-secure-store',
    'expo-font',
    'expo-web-browser',
    '@preeternal/react-native-cookie-manager',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F4F2EE',
        image: './assets/splash-icon.png',
        dark: {
          backgroundColor: '#1C1A16',
          image: './assets/splash-icon.png',
        },
        imageWidth: 160,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Use Face ID to unlock AI Draftsman B2B quickly and securely.',
      },
    ],
  ],

  extra: {
    appEnv: APP_ENV,
    eas: {
      // filled in when EAS project is created
    },
  },
});
