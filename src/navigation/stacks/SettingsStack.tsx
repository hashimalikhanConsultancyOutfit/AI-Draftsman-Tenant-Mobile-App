import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AccountFieldFormScreen } from '@/features/account/AccountFieldFormScreen';
import { AccountScreen } from '@/features/account/AccountScreen';
import { ChangePasswordScreen } from '@/features/account/ChangePasswordScreen';
import { AnalyticsScreen } from '@/features/analytics/AnalyticsScreen';
import { AppearanceScreen } from '@/features/settings/AppearanceScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { UsageCreditsScreen } from '@/features/usageCredits/UsageCreditsScreen';

import type { SettingsStackParamList } from '../types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="AccountFieldForm" component={AccountFieldFormScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="UsageCredits" component={UsageCreditsScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
    </Stack.Navigator>
  );
}
