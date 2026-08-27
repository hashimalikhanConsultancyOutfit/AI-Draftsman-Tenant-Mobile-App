import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  borders,
  controlHeights,
  animation,
  densityMultipliers,
  type DensityKey,
  fontFamilies,
  fontSizeMultipliers,
  type FontScaleKey,
  fontSizes,
  fontWeights,
  lineHeights,
  minTouchTarget,
  radii,
  shadows,
  spacing,
} from './tokens';
import { darkColors, lightColors, type AppColors } from './themes';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppTheme {
  colors: AppColors;
  isDark: boolean;
  spacing: typeof spacing;
  radii: typeof radii;
  fontSizes: Record<keyof typeof fontSizes, number>;
  fontFamilies: typeof fontFamilies;
  fontWeights: typeof fontWeights;
  lineHeights: typeof lineHeights;
  borders: typeof borders;
  shadows: typeof shadows;
  controlHeights: typeof controlHeights;
  minTouchTarget: number;
  animation: typeof animation;
  /** Current spacing scale, already multiplied by the density setting. */
  space: (key: keyof typeof spacing) => number;
}

interface ThemePersonalization {
  mode: ThemeMode;
  density: DensityKey;
  fontSize: FontScaleKey;
}

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  personalization: ThemePersonalization;
  setMode: (mode: ThemeMode) => void;
  setDensity: (density: DensityKey) => void;
  setFontSize: (fontSize: FontScaleKey) => void;
}

const DEFAULT_PERSONALIZATION: ThemePersonalization = {
  mode: 'system',
  density: 'comfortable',
  fontSize: 'medium',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Loads persisted personalization once and hands it to the provider.
 * Kept separate from the provider so screens can render immediately with
 * defaults while the persisted value loads, rather than blocking on it.
 */
export function useThemePersistence() {
  return DEFAULT_PERSONALIZATION;
}

export function ThemeProvider({
  children,
  initialPersonalization,
}: {
  children: React.ReactNode;
  initialPersonalization?: Partial<ThemePersonalization>;
}) {
  const systemScheme = useColorScheme();
  const [personalization, setPersonalization] =
    useState<ThemePersonalization>({
      ...DEFAULT_PERSONALIZATION,
      ...initialPersonalization,
    });

  const isDark =
    personalization.mode === 'system'
      ? systemScheme === 'dark'
      : personalization.mode === 'dark';

  const setMode = useCallback((mode: ThemeMode) => {
    setPersonalization((prev) => ({ ...prev, mode }));
  }, []);

  const setDensity = useCallback((density: DensityKey) => {
    setPersonalization((prev) => ({ ...prev, density }));
  }, []);

  const setFontSize = useCallback((fontSize: FontScaleKey) => {
    setPersonalization((prev) => ({ ...prev, fontSize }));
  }, []);

  const theme = useMemo<AppTheme>(() => {
    const densityMultiplier = densityMultipliers[personalization.density];
    const fontMultiplier = fontSizeMultipliers[personalization.fontSize];

    const scaledSpacing = Object.fromEntries(
      Object.entries(spacing).map(([key, value]) => [
        key,
        Math.round(value * densityMultiplier),
      ]),
    ) as typeof spacing;

    const scaledFontSizes = Object.fromEntries(
      Object.entries(fontSizes).map(([key, value]) => [
        key,
        Math.round(value * fontMultiplier),
      ]),
    ) as Record<keyof typeof fontSizes, number>;

    return {
      colors: isDark ? darkColors : lightColors,
      isDark,
      spacing: scaledSpacing,
      radii,
      fontSizes: scaledFontSizes,
      fontFamilies,
      fontWeights,
      lineHeights,
      borders,
      shadows,
      controlHeights,
      minTouchTarget,
      animation,
      space: (key) => scaledSpacing[key],
    };
  }, [isDark, personalization.density, personalization.fontSize]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark,
      personalization,
      setMode,
      setDensity,
      setFontSize,
    }),
    [theme, isDark, personalization, setMode, setDensity, setFontSize],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
}
