import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LeadDetailScreen } from '@/features/leads/LeadDetailScreen';
import { LeadFormScreen } from '@/features/leads/LeadFormScreen';
import { LeadReasoningScreen } from '@/features/leads/LeadReasoningScreen';
import { LeadsScreen } from '@/features/leads/LeadsScreen';

import type { LeadsStackParamList } from '../types';

const Stack = createNativeStackNavigator<LeadsStackParamList>();

export function LeadsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeadsHome" component={LeadsScreen} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
      <Stack.Screen name="LeadForm" component={LeadFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="LeadReasoning" component={LeadReasoningScreen} />
    </Stack.Navigator>
  );
}
