import { palette } from './tokens';

export interface AppColors {
  // Brand
  accent: string;
  primary: string;
  secondary: string;

  // Status
  error: string;
  success: string;
  info: string;
  warning: string;

  // Surfaces
  background: string;
  surface: string;
  surfaceRaised: string;
  scrim: string;

  // Text
  text: string;
  textMuted: string;
  textOnAccent: string;
  textOnDark: string;

  // Structure
  border: string;
  borderInteractive: string;
  white: string;

  // Status badge pairs — background + foreground, tuned for contrast
  // in both themes. Missing from the old app; added because the mobile
  // portal renders far more status chips (agents, clones, KBs, leads,
  // tickets, invoices...) than the old consumer app ever did.
  statusNeutralBg: string;
  statusNeutralFg: string;
  statusSuccessBg: string;
  statusSuccessFg: string;
  statusWarningBg: string;
  statusWarningFg: string;
  statusErrorBg: string;
  statusErrorFg: string;
  statusInfoBg: string;
  statusInfoFg: string;

  // Tab bar
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  tabBarBorder: string;
}

export const lightColors: AppColors = {
  accent: palette.brandTerracotta,
  primary: palette.brandDeepBrown,
  secondary: palette.brandNavy,

  error: palette.error,
  success: palette.success,
  info: palette.info,
  warning: palette.warning,

  background: palette.paper,
  surface: palette.white,
  surfaceRaised: palette.white,
  scrim: 'rgba(28, 26, 22, 0.5)',

  text: palette.ink,
  textMuted: palette.inkMuted,
  textOnAccent: palette.white,
  textOnDark: palette.paperOnDark,

  border: palette.borderLight,
  borderInteractive: palette.ink,
  white: palette.white,

  statusNeutralBg: '#E7E4DE',
  statusNeutralFg: '#5A5750',
  statusSuccessBg: '#E4F5EA',
  statusSuccessFg: '#1E7A44',
  statusWarningBg: '#FEF3EC',
  statusWarningFg: '#8A5A00',
  statusErrorBg: '#FDECEA',
  statusErrorFg: '#9B2042',
  statusInfoBg: '#E9F0FC',
  statusInfoFg: '#1E4DA8',

  tabBarBackground: palette.white,
  tabBarActive: palette.brandTerracotta,
  tabBarInactive: palette.inkMuted,
  tabBarBorder: palette.borderLight,
};

export const darkColors: AppColors = {
  accent: palette.brandTerracotta,
  primary: '#E8A278',
  secondary: '#7C93B8',

  error: '#E8637E',
  success: '#4FC183',
  info: '#5C8FE8',
  warning: '#D99A3D',

  background: palette.charcoal,
  surface: palette.charcoalSurface,
  surfaceRaised: palette.charcoalSurfaceRaised,
  scrim: 'rgba(0, 0, 0, 0.65)',

  text: palette.paperOnDark,
  textMuted: palette.paperMutedOnDark,
  textOnAccent: palette.white,
  textOnDark: palette.paperOnDark,

  border: palette.borderDark,
  borderInteractive: palette.paperOnDark,
  white: palette.white,

  statusNeutralBg: '#3A3733',
  statusNeutralFg: '#C9C6C0',
  statusSuccessBg: '#1B3A29',
  statusSuccessFg: '#4FC183',
  statusWarningBg: '#3D2E14',
  statusWarningFg: '#D99A3D',
  statusErrorBg: '#3D1A22',
  statusErrorFg: '#E8637E',
  statusInfoBg: '#1A2A44',
  statusInfoFg: '#5C8FE8',

  tabBarBackground: palette.charcoalSurface,
  tabBarActive: palette.brandTerracotta,
  tabBarInactive: palette.paperMutedOnDark,
  tabBarBorder: palette.borderDark,
};
