import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

// The wordmark used on the web app's login screen, exported as two fixed
// colour variants (rather than recoloured at runtime) since each is its own
// distinct lockup of the "draftsman" wordmark + TENANT badge, not a simple
// palette swap of the same artwork. Shared by the splash screen and any
// other spot (e.g. the login screen's eyebrow) that wants the same mark.
const LOGO_DARK_THEME = require('../../../assets/splash-logo-dark-theme.png');
const LOGO_LIGHT_THEME = require('../../../assets/splash-logo-light-theme.png');
// Each source PNG's own pixel dimensions, so an exact target width/height
// box can be computed per variant — relying on the `aspectRatio` style
// combined with resizeMode="contain" and no explicit height instead
// rendered the image at its raw source pixel size.
const LOGO_DARK_THEME_SOURCE_SIZE = { width: 365, height: 45 };
const LOGO_LIGHT_THEME_SOURCE_SIZE = { width: 619, height: 144 };

export function BrandLogo({ width = 180, style }: { width?: number; style?: StyleProp<ImageStyle> }) {
  const { theme } = useAppTheme();
  const sourceSize = theme.isDark ? LOGO_DARK_THEME_SOURCE_SIZE : LOGO_LIGHT_THEME_SOURCE_SIZE;
  const height = (width * sourceSize.height) / sourceSize.width;

  return (
    <Image
      source={theme.isDark ? LOGO_DARK_THEME : LOGO_LIGHT_THEME}
      resizeMode="contain"
      style={[{ width, height }, style]}
    />
  );
}
