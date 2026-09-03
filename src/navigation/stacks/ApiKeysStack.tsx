import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ApiKeyFormScreen } from '@/features/api-keys/ApiKeyFormScreen';
import { ApiKeysScreen } from '@/features/api-keys/ApiKeysScreen';
import { KeyUsageScreen } from '@/features/api-keys/KeyUsageScreen';
import { PoliciesScreen } from '@/features/api-keys/PoliciesScreen';
import { PolicyFormScreen } from '@/features/api-keys/PolicyFormScreen';
import { PolicyViewScreen } from '@/features/api-keys/PolicyViewScreen';
import { RotatingKeysScreen } from '@/features/api-keys/RotatingKeysScreen';

import type { ApiKeysStackParamList } from '../types';

const Stack = createNativeStackNavigator<ApiKeysStackParamList>();

export function ApiKeysStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ApiKeysHome" component={ApiKeysScreen} />
      <Stack.Screen name="ApiKeyForm" component={ApiKeyFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="KeyUsage" component={KeyUsageScreen} />
      <Stack.Screen name="RotatingKeys" component={RotatingKeysScreen} />
      <Stack.Screen name="Policies" component={PoliciesScreen} />
      <Stack.Screen name="PolicyForm" component={PolicyFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PolicyView" component={PolicyViewScreen} />
    </Stack.Navigator>
  );
}
