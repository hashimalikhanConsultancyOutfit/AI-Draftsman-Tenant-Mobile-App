import { DarkTheme, DefaultTheme, NavigationContainer, type LinkingOptions, type Theme } from '@react-navigation/native';

import { useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { AppNavigator } from './AppNavigator';
import { AuthNavigator } from './AuthNavigator';

/**
 * Deep link config. Only ResetPassword is currently reachable this way (the
 * emailed link, `aidraftsmantenant://reset-password/:token`) — it's
 * resolved against whichever navigator is mounted, so it only works while
 * signed out, which is the real-world case (a user clicks the email link
 * from outside the app). If the app is already authenticated when the link
 * fires, it's a no-op rather than a crash, since AppNavigator doesn't
 * declare a ResetPassword screen — acceptable for a case that means "you
 * already have a session, the reset link isn't really for you right now".
 */
const linking: LinkingOptions<Record<string, unknown>> = {
  prefixes: ['aidraftsmantenant://'],
  config: {
    screens: {
      Login: 'login',
      ResetPassword: 'reset-password/:token',
      PlaceholderHome: 'home',
    },
  },
};

export function RootNavigator() {
  const { theme, isDark } = useAppTheme();
  const phase = useAppSelector((state) => state.auth.phase);
  const isAuthenticated = phase === 'authenticated';

  const navigationTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.error,
    },
  };

  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
