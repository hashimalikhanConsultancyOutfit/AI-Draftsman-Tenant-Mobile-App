import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { Button } from './Button';
import { Icon, type IconName, type NavIconKey } from './Icon';

interface EmptyStateProps {
  icon?: IconName | NavIconKey;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'inbox', title, description, actionLabel, onAction }: EmptyStateProps) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full },
        ]}
      >
        <Icon name={icon} size={28} color={theme.colors.textMuted} />
      </View>
      <Text
        style={[
          styles.title,
          { color: theme.colors.text, fontSize: theme.fontSizes.lg, fontFamily: theme.fontFamilies.display.semibold },
        ]}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={[
            styles.description,
            { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, fontFamily: theme.fontFamilies.body.regular },
          ]}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: theme.space('md') }}>
          <Button label={actionLabel} onPress={onAction} variant="outline" size="sm" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  iconCircle: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { textAlign: 'center' },
  description: { textAlign: 'center', maxWidth: 280 },
});
