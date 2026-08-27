import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PlaceholderHomeScreen } from '@/screens/PlaceholderHomeScreen';

import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

/** Replaced by the real AppDrawer (5-tab bottom bar + BUILD/RUN/SETUP
 * sidebar) in Phase 3, once approved. */
export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PlaceholderHome" component={PlaceholderHomeScreen} />
    </Stack.Navigator>
  );
}
