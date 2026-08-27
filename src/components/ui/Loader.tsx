import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

interface LoaderProps {
  label?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function Loader({ label, size = 'large', fullScreen = false }: LoaderProps) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.wrapper,
        fullScreen && { flex: 1, backgroundColor: theme.colors.background },
      ]}
    >
      <ActivityIndicator size={size} color={theme.colors.accent} />
      {label && (
        <Text
          style={[
            styles.label,
            { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, fontFamily: theme.fontFamilies.body.regular },
          ]}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  label: { textAlign: 'center' },
});
