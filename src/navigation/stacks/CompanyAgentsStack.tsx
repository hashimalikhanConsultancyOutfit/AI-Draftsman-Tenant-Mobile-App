import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AgentDetailScreen } from '@/features/company-agents/AgentDetailScreen';
import { AgentFormScreen } from '@/features/company-agents/AgentFormScreen';
import { CloneOutScreen } from '@/features/company-agents/CloneOutScreen';
import { CompanyAgentsScreen } from '@/features/company-agents/CompanyAgentsScreen';

import type { CompanyAgentsStackParamList } from '../types';

const Stack = createNativeStackNavigator<CompanyAgentsStackParamList>();

export function CompanyAgentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompanyAgentsHome" component={CompanyAgentsScreen} />
      <Stack.Screen name="AgentDetail" component={AgentDetailScreen} />
      <Stack.Screen name="AgentForm" component={AgentFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AgentCloneOut" component={CloneOutScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
