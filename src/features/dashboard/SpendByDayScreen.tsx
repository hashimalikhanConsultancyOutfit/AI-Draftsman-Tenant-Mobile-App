import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { EmptyState, ErrorState, Loader } from '@/components/ui';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatDayLabel, formatMoney, formatMonthLabel } from '@/utils/format';

import type { DashboardStackParamList } from '@/navigation/types';
import { useGetDashboardQuery } from './dashboardApi';

type Rt = RouteProp<DashboardStackParamList, 'SpendByDay'>;

export function SpendByDayScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<Rt>();
  const canSeeMoney = usePermission(USAGE_PERMISSIONS.VIEW);
  const { data, isLoading, error, refetch } = useGetDashboardQuery({ period: params.period });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Spend by day" mode="stack" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <Loader fullScreen />
      ) : error ? (
        <ErrorState message="Could not load spend by day." onRetry={refetch} />
      ) : !canSeeMoney ? (
        <EmptyState icon="lock-outline" title="Not visible to you" description="Seeing spend figures needs the “View usage” permission." />
      ) : !data?.spendByDay.length ? (
        <EmptyState icon="bar-chart" title="No spend yet" description="Runs start appearing here once an agent is serving traffic." />
      ) : (
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes['2xl'] }}>
            {formatMoney(data.summary.spend, data.currency)}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginBottom: 8 }}>
            {formatMonthLabel(data.period)}
          </Text>
          {data.spendByDay.map((p) => (
            <View key={p.date} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>
                {formatDayLabel(p.date)}
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm }}>
                {formatMoney(p.spend, data.currency)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
