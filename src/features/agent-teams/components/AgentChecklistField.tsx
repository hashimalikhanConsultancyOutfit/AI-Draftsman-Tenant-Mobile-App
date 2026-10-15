import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Checkbox, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

interface AgentOption {
  value: string;
  label: string;
  /** Listed but not pickable (web: an agent that is not deployed), with
   * the reason on its own line under the name. */
  disabled?: boolean;
  hint?: string | null;
}

interface AgentChecklistFieldProps {
  label: string;
  hint?: string;
  error?: string;
  values: string[];
  options: readonly AgentOption[];
  onChange: (values: string[]) => void;
  /** The ceiling — once reached, every unticked row is disabled. */
  maxItems: number;
  loading?: boolean;
  loadError?: string | null;
}

/**
 * Web's `checklist` field (`RHFCheckboxList`), on mobile: every agent is a
 * row in a bounded, scrollable box rather than a chip dropdown, so a ticked
 * agent stays in place and is read back as part of the roster.
 *
 * Mirrors the web control's three behaviours: a search box that narrows
 * only what is DRAWN (a ticked row survives the filter, so a pick can
 * always be undone), a "n of max selected" counter, and every unticked row
 * disabled once the ceiling is reached.
 */
export function AgentChecklistField({ label, hint, error, values, options, onChange, maxItems, loading = false, loadError = null }: AgentChecklistFieldProps) {
  const { theme } = useAppTheme();
  const [filter, setFilter] = useState('');

  const q = filter.trim().toLowerCase();
  const visible = q ? options.filter((o) => values.includes(o.value) || o.label.toLowerCase().includes(q)) : options;
  const atMax = values.length >= maxItems;

  const toggle = (value: string, checked: boolean) => {
    if (checked) {
      if (values.includes(value) || atMax) return;
      onChange([...values, value]);
    } else {
      onChange(values.filter((v) => v !== value));
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{label}</Text>
        {/* Always shown, "0 of 8 selected" included — as web's counter. */}
        <Text style={{ color: atMax ? theme.colors.accent : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>
          {values.length} of {maxItems} selected
        </Text>
      </View>

      <View style={[styles.box, { borderColor: error ? theme.colors.error : theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface }]}>
        <View style={[styles.searchRow, { borderBottomColor: theme.colors.border }]}>
          <Icon name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Search agents…"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }]}
            accessibilityLabel={`Search ${label.toLowerCase()}`}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} style={{ padding: 16 }} />
        ) : loadError ? (
          <Text style={[styles.message, { color: theme.colors.error }]}>{loadError}</Text>
        ) : visible.length === 0 ? (
          <Text style={[styles.message, { color: theme.colors.textMuted }]}>
            {options.length === 0 ? 'No agents yet. Create one first — a team is a group of agents you already have.' : 'No agent matches that search.'}
          </Text>
        ) : (
          /* A plain View, not a nested ScrollView: the form screen already
             scrolls, and a nested vertical scroller fights it on Android. */
          <View style={styles.list}>
            {visible.map((option) => {
              const checked = values.includes(option.value);
              return (
                <View key={option.value} style={styles.row}>
                  <Checkbox label={option.label} checked={checked} disabled={(!checked && atMax) || Boolean(option.disabled && !checked)} onChange={(next) => toggle(option.value, next)} />
                  {option.hint ? (
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginLeft: 28, marginTop: 2 }}>{option.hint}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {(error || hint) && (
        <Text style={{ color: error ? theme.colors.error : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 6 }}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  box: { borderWidth: 1, overflow: 'hidden' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, paddingVertical: 10 },
  list: { paddingVertical: 4 },
  row: { paddingHorizontal: 12, paddingVertical: 9 },
  message: { padding: 14, fontSize: 12 },
});
