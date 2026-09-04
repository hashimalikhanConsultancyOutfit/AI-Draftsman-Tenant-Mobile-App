import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CreditRateFormScreen } from '@/features/organization-settings/CreditRateFormScreen';
import { OrganizationSettingsScreen } from '@/features/organization-settings/OrganizationSettingsScreen';

import type { OrganizationSettingsStackParamList } from '../types';

const Stack = createNativeStackNavigator<OrganizationSettingsStackParamList>();

export function OrganizationSettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrganizationSettingsHome" component={OrganizationSettingsScreen} />
      <Stack.Screen name="CreditRateForm" component={CreditRateFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
