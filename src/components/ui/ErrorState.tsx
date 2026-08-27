import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface ErrorStateProps {
  title?: string;
  message: string;
  icon?: IconName;
  retryLabel?: string;
  onRetry?: () => void;
}

/**
 * Generic error surface for a failed screen-level fetch. Pair with
 * ApiError/NetworkError from services/httpClient.ts — a screen typically
 * does:
 *
 *   <ErrorState
 *     icon={error instanceof NetworkError ? 'wifi-off' : 'error-outline'}
 *     message={error instanceof ApiError ? error.messages[0] : error.message}
 *     onRetry={refetch}
 *   />
 */
export function ErrorState({ title = 'Something went wrong', message, icon = 'error-outline', retryLabel = 'Try again', onRetry }: ErrorStateProps) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.colors.statusErrorBg, borderRadius: theme.radii.full },
        ]}
      >
        <Icon name={icon} size={28} color={theme.colors.statusErrorFg} />
      </View>
      <Text
        style={[
          styles.title,
          { color: theme.colors.text, fontSize: theme.fontSizes.lg, fontFamily: theme.fontFamilies.display.semibold },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.message,
          { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, fontFamily: theme.fontFamilies.body.regular },
        ]}
      >
        {message}
      </Text>
      {onRetry && (
        <View style={{ marginTop: theme.space('md') }}>
          <Button label={retryLabel} onPress={onRetry} variant="outline" size="sm" icon="refresh" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  iconCircle: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 280 },
});
