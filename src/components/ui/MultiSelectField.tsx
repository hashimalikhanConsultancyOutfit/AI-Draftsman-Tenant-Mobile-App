import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

interface Option {
  label: string;
  value: string;
}

interface MultiSelectFieldProps {
  label: string;
  hint?: string;
  values: string[];
  options: readonly Option[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
}

/**
 * A closed-list multi-select, presented as a chip row plus an "Add" button
 * that opens a checklist sheet — the mobile equivalent of the web form's MUI
 * multi-select dropdown. Built for Lead criteria's form (six of its fields
 * need this) and promoted here once Reports' "Group by" field needed the
 * same control — a shared primitive alongside `PickerField`, its
 * single-select counterpart.
 */
export function MultiSelectField({ label, hint, values, options, onChange, searchable = true }: MultiSelectFieldProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const labelFor = (value: string) => options.find((o) => o.value === value)?.label ?? value;
  const visible = filter.trim() ? options.filter((o) => o.label.toLowerCase().includes(filter.trim().toLowerCase())) : options;

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{label}</Text>

      <View style={styles.chipRow}>
        {values.map((value) => (
          <View key={value} style={[styles.chip, { backgroundColor: theme.colors.accent + '1A', borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.accent, fontSize: 12, fontFamily: theme.fontFamilies.body.medium }} numberOfLines={1}>
              {labelFor(value)}
            </Text>
            <TouchableOpacity onPress={() => toggle(value)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon name="close" size={12} color={theme.colors.accent} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setOpen(true)} style={[styles.addChip, { borderColor: theme.colors.border, borderRadius: theme.radii.full }]}>
          <Icon name="add" size={14} color={theme.colors.text} />
          <Text style={{ color: theme.colors.text, fontSize: 12, fontFamily: theme.fontFamilies.body.medium }}>Add</Text>
        </TouchableOpacity>
      </View>
      {hint && <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{hint}</Text>}

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop }]}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20, marginBottom: 10 }}>{label}</Text>
            {searchable && (
              <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                <TextInput value={filter} onChangeText={setFilter} placeholder="Search…" placeholderTextColor={theme.colors.textMuted} style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 8, color: theme.colors.text }} />
              </View>
            )}
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {visible.map((option) => {
                const isSelected = values.includes(option.value);
                return (
                  <TouchableOpacity key={option.value} onPress={() => toggle(option.value)} style={[styles.option, { borderColor: isSelected ? theme.colors.accent : theme.colors.border }]}>
                    <Text style={{ color: theme.colors.text, fontSize: 14, flex: 1 }}>{option.label}</Text>
                    {isSelected && <Icon name="check" size={16} color={theme.colors.accent} />}
                  </TouchableOpacity>
                );
              })}
              {visible.length === 0 && <Text style={{ color: theme.colors.textMuted, fontSize: 13, paddingVertical: 12 }}>No matches.</Text>}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
              <TouchableOpacity onPress={() => setOpen(false)} style={[styles.doneBtn, { backgroundColor: theme.colors.accent, borderRadius: theme.radii.full }]}>
                <Text style={{ color: theme.colors.textOnAccent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 14 }}>Done ({values.length})</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 220 },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10, maxHeight: '80%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  doneBtn: { alignItems: 'center', paddingVertical: 12 },
});
