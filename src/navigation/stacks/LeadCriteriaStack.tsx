import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LeadCriteriaFormScreen } from '@/features/lead-criteria/LeadCriteriaFormScreen';
import { LeadCriteriaRulesScreen } from '@/features/lead-criteria/LeadCriteriaRulesScreen';
import { LeadCriteriaScreen } from '@/features/lead-criteria/LeadCriteriaScreen';

import type { LeadCriteriaStackParamList } from '../types';

const Stack = createNativeStackNavigator<LeadCriteriaStackParamList>();

export function LeadCriteriaStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeadCriteriaHome" component={LeadCriteriaScreen} />
      <Stack.Screen name="LeadCriteriaForm" component={LeadCriteriaFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="LeadCriteriaRules" component={LeadCriteriaRulesScreen} />
    </Stack.Navigator>
  );
}
