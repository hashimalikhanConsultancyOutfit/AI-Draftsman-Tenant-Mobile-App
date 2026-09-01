import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CustomerDetailScreen } from '@/features/customers/CustomerDetailScreen';
import { CustomerFormScreen } from '@/features/customers/CustomerFormScreen';
import { CustomerImportScreen } from '@/features/customers/CustomerImportScreen';
import { CustomerSuspendScreen } from '@/features/customers/CustomerSuspendScreen';
import { CustomersScreen } from '@/features/customers/CustomersScreen';

import type { CustomersStackParamList } from '../types';

const Stack = createNativeStackNavigator<CustomersStackParamList>();

export function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomersHome" component={CustomersScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <Stack.Screen name="CustomerForm" component={CustomerFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CustomerSuspend" component={CustomerSuspendScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CustomerImport" component={CustomerImportScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
