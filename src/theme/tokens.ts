/**
 * Design tokens — ported from the existing AI Draftsman mobile app
 * (src/shared/theme/tokens.ts in the reference project) with two fixes:
 *
 * 1. `primary` is no longer overwritten by the user's accent colour at the
 *    provider level — the old app's `primary` token was effectively dead
 *    because ThemeProvider replaced it with `accentColour`. Here `accent`
 *    is the single source of truth for the user-personalisable brand
 *    colour, and `primary` stays a real, distinct token.
 * 2. Dark theme gets its own explicit surface/scrim/status tokens instead
 *    of only swapping neutrals — the old app's dark mode had known gaps
 *    (hardcoded light StatusBar, light-only loader overlay) that we are
 *    not carrying forward.
 */

export const palette = {
  // Brand — warm, paper-and-terracotta
  brandDeepBrown: '#6D2B07',
  brandTerracotta: '#C8622A', // the real brand colour — accent
  brandNavy: '#1A3050',

  // Status
  error: '#9B2042',
  errorStrong: '#C0392B',
  success: '#2E9E5B',
  info: '#1E4DA8',
  warning: '#8A5A00',

  // Light neutrals
  paper: '#F4F2EE',
  white: '#FFFFFF',
  ink: '#1C1A16',
  inkMuted: '#5A5750',
  borderLight: '#E0DDD8',

  // Dark neutrals
  charcoal: '#1C1A16',
  charcoalSurface: '#2A2724',
  charcoalSurfaceRaised: '#332F2A',
  paperOnDark: '#F4F2EE',
  paperMutedOnDark: '#A09D99',
  borderDark: '#3A3733',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export type SpacingKey = keyof typeof spacing;

/** User-adjustable density setting — multiplies the whole spacing scale. */
export const densityMultipliers = {
  compact: 0.75,
  comfortable: 1.0,
  spacious: 1.375,
} as const;

export type DensityKey = keyof typeof densityMultipliers;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 26,
  sheetTop: 28,
  full: 9999,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

/** User-adjustable font scale setting. */
export const fontSizeMultipliers = {
  small: 14 / 16,
  medium: 1.0,
  large: 18 / 16,
} as const;

export type FontSizeKey = keyof typeof fontSizes;
/** The user-adjustable font SCALE setting (small/medium/large) — distinct
 * from FontSizeKey, which names a step in the size scale (xs..3xl). Two
 * different concepts; keeping separate types is what caught the original
 * bug where ThemeContext typed `personalization.fontSize` as FontSizeKey
 * and then indexed fontSizeMultipliers (keyed small/medium/large) with it. */
export type FontScaleKey = keyof typeof fontSizeMultipliers;

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/**
 * Font families. Syne = display/headings/brand. Instrument Sans = body/UI.
 * Space Mono = numerics (money, OTP digits, IDs, token counts).
 * (Old app also loaded Bebas Neue with zero real usages — dropped.)
 */
export const fontFamilies = {
  display: {
    regular: 'Syne_400Regular',
    medium: 'Syne_500Medium',
    semibold: 'Syne_600SemiBold',
    bold: 'Syne_700Bold',
  },
  body: {
    regular: 'InstrumentSans_400Regular',
    medium: 'InstrumentSans_500Medium',
    semibold: 'InstrumentSans_600SemiBold',
    bold: 'InstrumentSans_700Bold',
  },
  mono: {
    regular: 'SpaceMono_400Regular',
  },
} as const;

/** Border widths. 1.5px on interactive strokes is a deliberate signature detail. */
export const borders = {
  hairline: 1,
  interactive: 1.5,
} as const;

interface ShadowToken {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export const shadows: Record<'sm' | 'md' | 'lg', ShadowToken> = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
};

/** Standard control heights, so buttons/inputs/list rows agree across screens. */
export const controlHeights = {
  sm: 36,
  md: 44,
  lg: 52,
} as const;

/** Minimum touch target per platform accessibility guidance. */
export const minTouchTarget = 44;

export const animation = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;
