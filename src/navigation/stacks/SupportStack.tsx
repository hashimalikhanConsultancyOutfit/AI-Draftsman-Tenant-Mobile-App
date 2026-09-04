import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EditTicketFormScreen } from '@/features/support/EditTicketFormScreen';
import { NoteFormScreen } from '@/features/support/NoteFormScreen';
import { RaiseTicketFormScreen } from '@/features/support/RaiseTicketFormScreen';
import { ReplyFormScreen } from '@/features/support/ReplyFormScreen';
import { SlaPolicyFormScreen } from '@/features/support/SlaPolicyFormScreen';
import { SupportScreen } from '@/features/support/SupportScreen';
import { TicketDetailScreen } from '@/features/support/TicketDetailScreen';

import type { SupportStackParamList } from '../types';

const Stack = createNativeStackNavigator<SupportStackParamList>();

export function SupportStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SupportHome" component={SupportScreen} />
      <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
      <Stack.Screen name="RaiseTicket" component={RaiseTicketFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EditTicket" component={EditTicketFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ReplyTicket" component={ReplyFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="NoteTicket" component={NoteFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SlaPolicy" component={SlaPolicyFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
