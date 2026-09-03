import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

interface TagArrayFieldProps {
  label: string;
  placeholder?: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  maxItems?: number;
  maxChars?: number;
}

/**
 * A free-text tag array — type a value, press add (or return), it becomes
 * a removable chip. The mobile equivalent of web's `TagArrayField` for
 * `jobTitles`/`departments`/`includeKeywords`/`excludeKeywords`/
 * `excludeDomains`/`technologies`/`sources`.
 */
export function TagArrayField({ label, placeholder, hint, values, onChange, maxItems = 50, maxChars = 120 }: TagArrayFieldProps) {
  const { theme } = useAppTheme();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const trimmed = draft.trim().slice(0, maxChars);
    if (!trimmed || values.length >= maxItems || values.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  };

  const remove = (value: string) => onChange(values.filter((v) => v !== value));

  return (
    <View style={styles.wrapper}>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{label}</Text>

      {values.length > 0 && (
        <View style={styles.chipRow}>
          {values.map((value) => (
            <View key={value} style={[styles.chip, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
              <Text style={{ color: theme.colors.text, fontSize: 12, fontFamily: theme.fontFamilies.body.medium }} numberOfLines={1}>
                {value}
              </Text>
              <TouchableOpacity onPress={() => remove(value)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Icon name="close" size={12} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.inputRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="done"
          style={{ flex: 1, color: theme.colors.text, paddingVertical: 10, fontSize: 14 }}
        />
        <TouchableOpacity onPress={commit} disabled={!draft.trim()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="add-circle" size={20} color={draft.trim() ? theme.colors.accent : theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
      {hint && <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 220 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, gap: 8 },
});
