import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Checkbox, TextField } from '@/components/ui';
import { useGetAllCustomersLiteQuery } from '@/features/company-agents/companyAgentsApi';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetWorkspaceMembersQuery } from '../surveysApi';
import { AUDIENCE_COPY, filterPickerOptions } from '../surveysRules';

interface AudiencePickerProps {
  kind: 'users' | 'customers';
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Web's `AudiencePicker` — every workspace member (`/onboarding/invites`)
 * or every customer, as a checklist with "{n} selected", Select all and
 * Clear. A search box is added for a phone, where the list cannot show
 * many rows at once; Select all still selects EVERY option, not just the
 * ones the search shows, exactly like web's button.
 */
export function AudiencePicker({ kind, selectedIds, onChange }: AudiencePickerProps) {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const members = useGetWorkspaceMembersQuery(undefined, { skip: kind !== 'users' });
  const customers = useGetAllCustomersLiteQuery(undefined, { skip: kind !== 'customers' });

  const options = useMemo(
    () =>
      kind === 'users'
        ? (members.data ?? []).map((m) => ({ id: m.userId, label: m.name?.trim() || m.email }))
        : (customers.data ?? []).map((c) => ({ id: c.id, label: c.name })),
    [kind, members.data, customers.data],
  );
  const visible = useMemo(() => filterPickerOptions(options, query), [options, query]);
  const isLoading = kind === 'users' ? members.isFetching : customers.isFetching;
  const selected = new Set(selectedIds);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const linkStyle = { color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.bar}>
        <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{AUDIENCE_COPY.selected(selectedIds.length)}</Text>
        <TouchableOpacity onPress={() => onChange(options.map((o) => o.id))} disabled={options.length === 0} hitSlop={8} accessibilityRole="button">
          <Text style={[linkStyle, options.length === 0 && { opacity: 0.4 }]}>{AUDIENCE_COPY.selectAll}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onChange([])} disabled={selectedIds.length === 0} hitSlop={8} accessibilityRole="button">
          <Text style={[linkStyle, selectedIds.length === 0 && { opacity: 0.4 }]}>{AUDIENCE_COPY.clear}</Text>
        </TouchableOpacity>
      </View>
      {options.length > 6 ? (
        <TextField placeholder={AUDIENCE_COPY.searchPlaceholder} leftIcon="search" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
      ) : null}
      <View style={[styles.box, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
        <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }} contentContainerStyle={{ padding: 10, gap: 12 }}>
          {isLoading && options.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Loading…</Text>
          ) : options.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{kind === 'users' ? AUDIENCE_COPY.noMembers : AUDIENCE_COPY.noCustomers}</Text>
          ) : visible.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Nothing matches that search.</Text>
          ) : (
            visible.map((o) => <Checkbox key={o.id} label={o.label} checked={selected.has(o.id)} onChange={() => toggle(o.id)} />)
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  box: { borderWidth: StyleSheet.hairlineWidth },
});
