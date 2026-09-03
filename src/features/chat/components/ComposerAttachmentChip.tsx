import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ComposerAttachment } from '../chat.types';
import { formatFileSize } from '../chatRules';

interface ComposerAttachmentChipProps {
  attachment: ComposerAttachment;
  onRemove: () => void;
  onRetry: () => void;
}

/**
 * One pending attachment above the composer's input row. Three states:
 * uploading (determinate bar), ready (plain chip), failed (chip + Retry —
 * the blob is still in memory so this never re-prompts the picker).
 */
export function ComposerAttachmentChip({ attachment, onRemove, onRetry }: ComposerAttachmentChipProps) {
  const { theme } = useAppTheme();
  const iconName =
    attachment.kind === 'PHOTO' ? 'image' : attachment.kind === 'VIDEO' ? 'videocam' : 'insert-drive-file';

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: theme.colors.accent + '1A' }]}>
        {attachment.state === 'uploading' ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <Icon name={iconName} size={16} color={theme.colors.accent} />
        )}
      </View>

      <View style={styles.meta}>
        <Text numberOfLines={1} style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 12 }}>
          {attachment.filename}
        </Text>
        {attachment.state === 'uploading' && (
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.colors.accent, width: `${Math.max(4, attachment.progress * 100)}%` },
              ]}
            />
          </View>
        )}
        {attachment.state === 'ready' && (
          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{formatFileSize(attachment.sizeBytes)}</Text>
        )}
        {attachment.state === 'failed' && (
          <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry upload">
            <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
              Retry upload
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${attachment.filename}`}
      >
        <Icon name="close" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderWidth: 1, minWidth: 160, maxWidth: 220 },
  iconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, minWidth: 0, gap: 3 },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
});
