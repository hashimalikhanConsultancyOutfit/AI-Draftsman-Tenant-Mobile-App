import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { RecentRunsScreen } from '@/features/dashboard/RecentRunsScreen';
import { SpendByDayScreen } from '@/features/dashboard/SpendByDayScreen';
import { TopBySpendScreen } from '@/features/dashboard/TopBySpendScreen';

import type { DashboardStackParamList } from '../types';

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="SpendByDay" component={SpendByDayScreen} />
      <Stack.Screen name="TopBySpend" component={TopBySpendScreen} />
      <Stack.Screen name="RecentRuns" component={RecentRunsScreen} />
    </Stack.Navigator>
  );
}
