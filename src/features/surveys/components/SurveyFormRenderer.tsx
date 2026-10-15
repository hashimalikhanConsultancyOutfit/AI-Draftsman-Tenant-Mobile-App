import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Checkbox, Icon, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SurveyField } from '../surveys.types';
import { FORM_COPY } from '../surveysRules';

const KEYBOARD: Partial<Record<SurveyField['kind'], 'email-address' | 'phone-pad' | 'numeric' | 'url'>> = {
  email: 'email-address',
  phone: 'phone-pad',
  number: 'numeric',
  url: 'url',
};

/** Web's `RATING_VALUES` — a rating answer is a NUMBER 1–5. */
const RATING_VALUES = [1, 2, 3, 4, 5];

interface SurveyFormRendererProps {
  schema: readonly SurveyField[];
  /** Controlled mode (My Surveys' fill screen). Omit both for the
   * manager's Preview, which keeps its answers locally. */
  values?: Record<string, unknown>;
  onChange?: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

/**
 * Web's `SurveyFormRenderer` — the form the way a respondent sees it:
 * section headings, text inputs per kind, select as a single choice,
 * multiselect as checkboxes, rating as 1–5, Yes / No. Used by the
 * manager's Preview and by My Surveys' fill screen.
 */
export function SurveyFormRenderer({ schema, values: controlled, onChange, errors = {}, disabled = false }: SurveyFormRendererProps) {
  const { theme } = useAppTheme();
  const [local, setLocal] = useState<Record<string, unknown>>({});
  const values = controlled ?? local;
  const set = (key: string, value: unknown) => {
    if (disabled) return;
    if (onChange) onChange(key, value);
    else setLocal((a) => ({ ...a, [key]: value }));
  };

  if (schema.filter((f) => f.kind !== 'section').length === 0) {
    return <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>{FORM_COPY.previewEmpty}</Text>;
  }

  const chip = (selected: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        { borderRadius: theme.radii.full, borderColor: selected ? theme.colors.accent : theme.colors.border, backgroundColor: selected ? theme.colors.accent + '1A' : theme.colors.surface },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <Text style={{ color: selected ? theme.colors.accent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ gap: 20 }}>
      {schema.map((field) => {
        if (field.kind === 'section') {
          return (
            <View key={field.key} style={{ gap: 4, paddingTop: 4 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{field.label}</Text>
              {field.help ? <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{field.help}</Text> : null}
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginTop: 4 }} />
            </View>
          );
        }
        const label = `${field.label}${field.required ? ' *' : ''}`;
        const value = values[field.key];
        const error = errors[field.key];
        const head = (
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{label}</Text>
        );
        const foot = (
          <>
            {field.help && !error ? <Text style={[styles.foot, { color: theme.colors.textMuted }]}>{field.help}</Text> : null}
            {error ? <Text style={[styles.foot, { color: theme.colors.error }]}>{error}</Text> : null}
          </>
        );
        switch (field.kind) {
          case 'select':
            return (
              <View key={field.key} style={{ gap: 6 }}>
                {head}
                {(field.options ?? []).map((o) => (
                  <TouchableOpacity key={o} disabled={disabled} onPress={() => set(field.key, o)} style={styles.radioRow} accessibilityRole="radio" accessibilityState={{ checked: value === o }}>
                    <Icon name={value === o ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={value === o ? theme.colors.accent : theme.colors.textMuted} />
                    <Text style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}>{o}</Text>
                  </TouchableOpacity>
                ))}
                {foot}
              </View>
            );
          case 'multiselect': {
            const picked = Array.isArray(value) ? (value as string[]) : [];
            return (
              <View key={field.key} style={{ gap: 8 }}>
                {head}
                {(field.options ?? []).map((o) => (
                  <Checkbox key={o} label={o} disabled={disabled} checked={picked.includes(o)} onChange={(c) => set(field.key, c ? [...picked, o] : picked.filter((x) => x !== o))} />
                ))}
                {foot}
              </View>
            );
          }
          case 'rating':
            return (
              <View key={field.key} style={{ gap: 6 }}>
                {head}
                <View style={styles.chips}>{RATING_VALUES.map((n) => chip(value === n, String(n), () => set(field.key, n), String(n)))}</View>
                {foot}
              </View>
            );
          case 'boolean':
            return (
              <View key={field.key} style={{ gap: 6 }}>
                {head}
                <View style={styles.chips}>
                  {chip(value === true, 'Yes', () => set(field.key, true), 'yes')}
                  {chip(value === false, 'No', () => set(field.key, false), 'no')}
                </View>
                {foot}
              </View>
            );
          default:
            return (
              <TextField
                key={field.key}
                label={label}
                value={typeof value === 'string' ? value : ''}
                onChangeText={(t) => set(field.key, t)}
                editable={!disabled}
                placeholder={field.kind === 'date' ? 'YYYY-MM-DD' : undefined}
                keyboardType={KEYBOARD[field.kind] ?? 'default'}
                multiline={field.kind === 'textarea'}
                style={field.kind === 'textarea' ? { minHeight: 96, textAlignVertical: 'top', paddingTop: 10 } : undefined}
                autoCapitalize={field.kind === 'email' || field.kind === 'url' ? 'none' : 'sentences'}
                hint={field.help}
                error={error}
              />
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 9, minWidth: 48, alignItems: 'center' },
  foot: { fontSize: 12, lineHeight: 17 },
});
