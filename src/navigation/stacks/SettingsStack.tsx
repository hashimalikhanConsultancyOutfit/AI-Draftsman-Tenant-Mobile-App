import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AccountScreen } from '@/features/settings/AccountScreen';
import { AnalyticsScreen } from '@/features/settings/AnalyticsScreen';
import { AppearanceScreen } from '@/features/settings/AppearanceScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { UsageCreditsScreen } from '@/features/settings/UsageCreditsScreen';

import type { SettingsStackParamList } from '../types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="UsageCredits" component={UsageCreditsScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
    </Stack.Navigator>
  );
}
