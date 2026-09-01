import type { SerializedError } from '@reduxjs/toolkit';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Icon, Loader, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';

import type { CompanyAgentsStackParamList } from '@/navigation/types';
import { useCloneAgentToCustomersMutation, useGetAgentsQuery, useGetAllCustomersLiteQuery } from './companyAgentsApi';

type Nav = NativeStackNavigationProp<CompanyAgentsStackParamList>;
type Rt = RouteProp<CompanyAgentsStackParamList, 'AgentCloneOut'>;

export function CloneOutScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: agents } = useGetAgentsQuery();
  const agent = agents?.find((a) => a.id === params.id) ?? null;

  const { data: customers, isLoading, error, refetch } = useGetAllCustomersLiteQuery();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [cloneAgentToCustomers, { isLoading: isCloning }] = useCloneAgentToCustomersMutation();

  const filtered = useMemo(() => {
    const list = customers ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, search]);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!agent || selected.length === 0) return;
    try {
      await cloneAgentToCustomers({ agentId: agent.id, customerIds: selected }).unwrap();
      toast.show(`Cloned to ${selected.length} ${selected.length === 1 ? 'customer' : 'customers'}.`, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not clone this agent.'), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Clone out" mode="stack" onBack={() => navigation.goBack()} />
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginBottom: 12 }}>
          Each customer gets a full independent copy of {agent?.name ?? 'this agent'} at the current master version. Editing a clone later never reaches back into this agent.
        </Text>
        <TextField leftIcon="search" placeholder="Search customers" value={search} onChangeText={setSearch} />
      </View>

      {isLoading ? (
        <Loader fullScreen />
      ) : error ? (
        <ErrorState message="Could not load your customers." onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="business" title="No customers found" description={search ? 'Try a different search.' : 'Register a customer first.'} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
              <TouchableOpacity
                onPress={() => toggle(item.id)}
                style={[styles.row, { borderBottomColor: theme.colors.border }]}
                activeOpacity={0.7}
              >
                <Icon name={checked ? 'check-box' : 'check-box-outline-blank'} size={20} color={checked ? theme.colors.accent : theme.colors.textMuted} />
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {selected.length > 0 && (
        <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border, paddingBottom: insets.bottom + 12 }]}>
          <Button
            label={`Clone out to ${selected.length} ${selected.length === 1 ? 'customer' : 'customers'}`}
            onPress={handleSubmit}
            loading={isCloning}
            fullWidth
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
