import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AgentFormScreen } from '@/features/company-agents/AgentFormScreen';
import { CustomerFormScreen } from '@/features/customers/CustomerFormScreen';
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
      {/* Reused in-place from the Customers stack — "Register customer"
          opens this inline rather than jumping to the Customers drawer
          screen, matching MarketplaceStack's reuse of AgentFormScreen. */}
      <Stack.Screen name="CustomerForm" component={CustomerFormScreen} options={{ presentation: 'modal' }} />
      {/* Reused in-place from the Company Agents stack — "Create agent"
          opens this inline rather than switching tabs. */}
      <Stack.Screen name="AgentForm" component={AgentFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
