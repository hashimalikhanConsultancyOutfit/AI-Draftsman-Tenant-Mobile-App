import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ReportFormScreen } from '@/features/reports/ReportFormScreen';
import { ReportLogsScreen } from '@/features/reports/ReportLogsScreen';
import { ReportsScreen } from '@/features/reports/ReportsScreen';

import type { ReportsStackParamList } from '../types';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReportsHome" component={ReportsScreen} />
      <Stack.Screen name="ReportForm" component={ReportFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ReportLogs" component={ReportLogsScreen} />
    </Stack.Navigator>
  );
}
