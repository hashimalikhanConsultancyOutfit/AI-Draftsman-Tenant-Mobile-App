import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { QueuedMessage } from '../chat.types';

const VISIBLE_LIMIT = 4;

interface SendQueueRailProps {
  queue: QueuedMessage[];
  /** Why sending is currently held up — shown once under the rail rather
   * than repeated per chip. */
  holdNote: string | null;
  onRemove: (id: string) => void;
}

/**
 * The parked-message rail above the composer. A turn is queued rather than
 * dispatched immediately when a previous answer is still streaming or the
 * composer is blocked — this rail is what shows the user their message
 * wasn't lost, just waiting its turn.
 *
 * Matches the web's precedence: only a `waiting` chip gets a remove button;
 * a `launching` one (already handed to the server) does not — cancelling it
 * belongs to the transcript now, via Retry if it fails.
 */
export function SendQueueRail({ queue, holdNote, onRemove }: SendQueueRailProps) {
  const { theme } = useAppTheme();
  if (queue.length === 0) return null;

  const visible = queue.slice(0, VISIBLE_LIMIT);
  const overflow = queue.length - visible.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
          QUEUED
        </Text>
        <View style={[styles.countPill, { backgroundColor: theme.colors.statusNeutralBg }]}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{queue.length}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {visible.map((item) => (
          <View
            key={item.id}
            style={[
              styles.chip,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.full },
            ]}
          >
            <Text numberOfLines={1} style={{ color: theme.colors.text, fontSize: 12, maxWidth: 140 }}>
              {item.body || 'Attachment'}
            </Text>
            {item.state === 'waiting' && (
              <TouchableOpacity
                onPress={() => onRemove(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove from queue: ${item.body}`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Icon name="close" size={13} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {overflow > 0 && (
          <View style={[styles.chip, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>+{overflow}</Text>
          </View>
        )}
      </ScrollView>

      {holdNote && (
        <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 4 }}>{holdNote}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  countPill: { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 },
  chips: { gap: 8, paddingRight: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
});
