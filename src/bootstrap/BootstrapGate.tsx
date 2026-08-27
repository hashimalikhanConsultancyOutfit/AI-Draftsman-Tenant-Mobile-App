import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Syne_400Regular, Syne_500Medium, Syne_600SemiBold, Syne_700Bold } from '@expo-google-fonts/syne';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { useGetSessionQuery } from '@/store/authApi';

import { BrandSplash } from './BrandSplash';

// Module-scope, per expo-splash-screen's own contract — must run before the
// first render, not inside an effect, or the native splash can auto-hide
// before we're ready.
void SplashScreen.preventAutoHideAsync();

const MINIMUM_SPLASH_MS = 700;

/**
 * Orchestrates cold start: keeps the native launch frame up, loads the
 * three brand font families, kicks off the GET /auth/session bootstrap
 * (which the authSlice turns into a phase — see authApi.ts's
 * onQueryStarted), then hands off to the animated BrandSplash for a beat
 * before revealing the real UI underneath.
 *
 * `children` (the RootNavigator) is mounted immediately, underneath the
 * splash overlay — not gated behind a loading check — so the native-to-JS
 * transition has no blank frame, and RootNavigator itself only needs to
 * know how to render the `bootstrapping` auth phase.
 */
export function BootstrapGate({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  const [fontsLoaded, fontError] = useFonts({
    Syne_400Regular,
    Syne_500Medium,
    Syne_600SemiBold,
    Syne_700Bold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    SpaceMono_400Regular,
  });

  const { isUninitialized, isLoading: sessionLoading } = useGetSessionQuery(undefined, {
    // The bootstrap check has to hit the network every cold start — the
    // whole point is asking "is the cookie in the native jar still good?",
    // which no cache can answer.
    refetchOnMountOrArgChange: true,
  });

  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const nativeSplashHidden = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumTimeElapsed(true), MINIMUM_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  const fontsReady = fontsLoaded || Boolean(fontError);
  const sessionReady = !isUninitialized && !sessionLoading;
  const appReady = fontsReady && sessionReady;

  const onLayoutRootView = useCallback(async () => {
    if (appReady && !nativeSplashHidden.current) {
      nativeSplashHidden.current = true;
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  useEffect(() => {
    void onLayoutRootView();
  }, [onLayoutRootView]);

  useEffect(() => {
    if (appReady && minimumTimeElapsed) {
      setShowSplash(false);
    }
  }, [appReady, minimumTimeElapsed]);

  if (!fontsReady) {
    // Nothing to render yet at all — the native splash is still covering
    // the screen (fonts are the one dependency that must resolve before
    // any themed text, including BrandSplash's own wordmark, can paint).
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {children}
      <BrandSplash visible={showSplash} />
    </View>
  );
}
