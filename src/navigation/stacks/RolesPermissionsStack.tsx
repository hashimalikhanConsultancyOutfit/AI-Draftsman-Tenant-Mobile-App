import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RoleFormScreen } from '@/features/roles/RoleFormScreen';
import { RolesScreen } from '@/features/roles/RolesScreen';

import type { RolesPermissionsStackParamList } from '../types';

const Stack = createNativeStackNavigator<RolesPermissionsStackParamList>();

export function RolesPermissionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RolesHome" component={RolesScreen} />
      <Stack.Screen name="RoleForm" component={RoleFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
