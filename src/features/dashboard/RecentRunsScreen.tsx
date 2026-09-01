import { FlatList, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { EmptyState, ErrorState, Loader } from '@/components/ui';
import { usePermission } from '@/permissions/usePermission';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';
import { useAppTheme } from '@/theme/ThemeContext';

import type { DashboardStackParamList } from '@/navigation/types';
import type { RecentRun } from './dashboard.types';
import { RunRow } from './components/RunRow';
import { useGetDashboardQuery } from './dashboardApi';

type Rt = RouteProp<DashboardStackParamList, 'RecentRuns'>;

export function RecentRunsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<Rt>();
  const canSeeMoney = usePermission(USAGE_PERMISSIONS.VIEW);
  const { data, isLoading, error, refetch } = useGetDashboardQuery({ period: params.period });

  const renderItem = ({ item }: { item: RecentRun }) => (
    <View style={{ paddingHorizontal: 16 }}>
      <RunRow run={item} showCost={canSeeMoney} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Recent runs" mode="stack" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <Loader fullScreen />
      ) : error ? (
        <ErrorState message="Could not load recent runs." onRetry={refetch} />
      ) : !data?.recentRuns.length ? (
        <EmptyState icon="history" title="No runs yet" description="Runs appear here as soon as an agent serves its first request." />
      ) : (
        <FlatList
          data={data.recentRuns}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 8 }}
        />
      )}
    </View>
  );
}

