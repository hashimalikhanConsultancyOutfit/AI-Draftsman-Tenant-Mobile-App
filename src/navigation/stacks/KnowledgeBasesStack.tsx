import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { KnowledgeBaseDetailScreen } from '@/features/knowledge-bases/KnowledgeBaseDetailScreen';
import { KnowledgeBaseEditScreen } from '@/features/knowledge-bases/KnowledgeBaseEditScreen';
import { KnowledgeBaseUploadScreen } from '@/features/knowledge-bases/KnowledgeBaseUploadScreen';
import { KnowledgeBasesScreen } from '@/features/knowledge-bases/KnowledgeBasesScreen';

import type { KnowledgeBasesStackParamList } from '../types';

const Stack = createNativeStackNavigator<KnowledgeBasesStackParamList>();

export function KnowledgeBasesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="KnowledgeBasesHome" component={KnowledgeBasesScreen} />
      <Stack.Screen name="KnowledgeBaseDetail" component={KnowledgeBaseDetailScreen} />
      <Stack.Screen name="KnowledgeBaseEdit" component={KnowledgeBaseEditScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="KnowledgeBaseUpload" component={KnowledgeBaseUploadScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
