import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/ThemeContext';
import { Icon } from './Icon';

export interface PickerOption {
  label: string;
  value: string;
  /** A second, muted line under the label — in the sheet only, so the
   * field itself stays a short single line. */
  description?: string;
  /** Shown but not pickable — web's disabled option. Put the reason in
   * `description` so the row says why. */
  disabled?: boolean;
}

interface PickerFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  value: string;
  options: readonly PickerOption[];
  onChange: (value: string) => void;
  /** Renders a text filter above the option list — worth it past a
   * handful of options (countries, industries). */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
}

/**
 * A single-select field, presented as a button that opens a bottom sheet
 * of options — this app's established ad-hoc sheet pattern (see
 * `SetKnowledgeBaseSheet`), pulled out as a shared primitive since Leads
 * and Lead criteria both need several plain single-selects with no
 * dedicated screen worth a whole component per field.
 */
export function PickerField({ label, hint, error, placeholder = 'Select…', value, options, onChange, searchable = false, searchPlaceholder = 'Search…', disabled = false }: PickerFieldProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const selected = options.find((o) => o.value === value);
  const visible = filter.trim() ? options.filter((o) => o.label.toLowerCase().includes(filter.trim().toLowerCase())) : options;

  return (
    <View style={styles.wrapper}>
      {/* Same label style as TextField, so mixed forms read as one. */}
      {label && <Text style={[styles.label, { color: theme.colors.text, fontSize: theme.fontSizes.sm, fontFamily: theme.fontFamilies.body.medium }]}>{label}</Text>}
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={[
          styles.field,
          {
            borderColor: error ? theme.colors.error : theme.colors.border,
            borderWidth: theme.borders.interactive,
            borderRadius: theme.radii.lg,
            minHeight: theme.controlHeights.md,
            backgroundColor: disabled ? theme.colors.statusNeutralBg : theme.colors.surface,
          },
        ]}
        accessibilityRole="button"
      >
        <Text style={{ color: selected ? theme.colors.text : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.md, flex: 1 }} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Icon name="expand-more" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>
      {hint && !error && <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{hint}</Text>}
      {error && <Text style={[styles.hint, { color: theme.colors.error }]}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop }]}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            {label && (
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20, marginBottom: 10 }}>{label}</Text>
            )}
            {searchable && (
              <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                <TextInput
                  value={filter}
                  onChangeText={setFilter}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 8, color: theme.colors.text }}
                />
              </View>
            )}
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {visible.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  disabled={option.disabled}
                  accessibilityState={{ disabled: Boolean(option.disabled), selected: value === option.value }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                    setFilter('');
                  }}
                  style={[styles.option, { borderColor: value === option.value ? theme.colors.accent : theme.colors.border, backgroundColor: value === option.value ? theme.colors.accent + '0D' : 'transparent', opacity: option.disabled ? 0.5 : 1 }]}
                >
                  {/* flex: 1 so a long label wraps INSIDE the row and the
                      check keeps its own slot instead of hitting the border. */}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 14 }}>{option.label}</Text>
                    {option.description ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, lineHeight: 17 }}>{option.description}</Text> : null}
                  </View>
                  {value === option.value && <Icon name="check" size={18} color={theme.colors.accent} />}
                </TouchableOpacity>
              ))}
              {visible.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 13, paddingVertical: 12 }}>No matches.</Text>}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13 },
  field: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  hint: { fontSize: 12, lineHeight: 17 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10, maxHeight: '75%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
