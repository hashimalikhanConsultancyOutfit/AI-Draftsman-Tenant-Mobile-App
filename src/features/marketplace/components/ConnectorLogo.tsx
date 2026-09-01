import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

/** First letters of the first two words — "Google Drive" -> "GD". */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  return ((first[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
}

/** Deterministic hash so the same connector always gets the same swatch. */
function monogramHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
}

function decodeDataUriPayload(uri: string): string | null {
  const comma = uri.indexOf(',');
  if (comma === -1) return null;
  const isBase64 = /;base64/i.test(uri.slice(0, comma));
  const payload = uri.slice(comma + 1);
  try {
    if (!isBase64) return decodeURIComponent(payload);
    // RN/Hermes ships a global atob.
    return typeof atob === 'function' ? atob(payload) : null;
  } catch {
    return null;
  }
}

/**
 * The gateway's `logo` field is often a data-URI SVG that embeds a remote
 * favicon fetch (`<image href="https://www.google.com/s2/favicons?...">`) —
 * pulled out here rather than handed straight to `<Image>`, since React
 * Native's Image component doesn't render inline SVG data URIs at all.
 * Ported from web's `extractLogoSrc`.
 */
function extractLogoSrc(logo: string | null): string | null {
  if (!logo) return null;
  if (!logo.startsWith('data:image/svg+xml')) return logo;
  const decoded = decodeDataUriPayload(logo);
  if (decoded === null) return null;
  const match = decoded.match(/<image[^>]*?(?:xlink:)?href\s*=\s*['"]([^'"]+)['"]/i);
  if (match?.[1]) return match[1].replace(/&amp;/g, '&');
  return null;
}

interface ConnectorLogoProps {
  name: string;
  logo: string | null;
  size?: number;
  /** Mute the mark — for a connector the platform has not enabled yet. */
  dimmed?: boolean;
}

export function ConnectorLogo({ name, logo, size = 40, dimmed = false }: ConnectorLogoProps) {
  const { theme } = useAppTheme();
  const src = extractLogoSrc(logo);

  const [failed, setFailed] = useState(false);
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setFailed(false);
  }

  const showImage = Boolean(src) && !failed;
  const swatches = [theme.colors.accent, theme.colors.statusSuccessFg, theme.colors.statusInfoFg, theme.colors.statusWarningFg, theme.colors.statusErrorFg];
  const swatch = swatches[monogramHue(name) % swatches.length] ?? theme.colors.accent;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: theme.radii.sm,
          backgroundColor: showImage ? theme.colors.surface : swatch,
          borderWidth: showImage ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.colors.border,
          padding: showImage ? Math.round(size * 0.14) : 0,
          opacity: dimmed ? 0.5 : 1,
        },
      ]}
    >
      {showImage && src ? (
        <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="contain" onError={() => setFailed(true)} />
      ) : (
        <Text style={{ color: theme.colors.textOnAccent, fontFamily: theme.fontFamilies.body.semibold, fontSize: size * 0.36 }}>{monogram(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
});
