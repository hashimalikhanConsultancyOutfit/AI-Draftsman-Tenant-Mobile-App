import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CloneDetailScreen } from '@/features/customer-agents/CloneDetailScreen';
import { CloneEditScreen } from '@/features/customer-agents/CloneEditScreen';
import { CustomerAgentsScreen } from '@/features/customer-agents/CustomerAgentsScreen';

import type { CustomerAgentsStackParamList } from '../types';

const Stack = createNativeStackNavigator<CustomerAgentsStackParamList>();

export function CustomerAgentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerAgentsHome" component={CustomerAgentsScreen} />
      <Stack.Screen name="CloneDetail" component={CloneDetailScreen} />
      <Stack.Screen name="CloneEdit" component={CloneEditScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
