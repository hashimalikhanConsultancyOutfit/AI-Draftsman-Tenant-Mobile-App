import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { KNOWLEDGE_BASE_PERMISSIONS } from '@/permissions/slugs';

export function KnowledgeBasesScreen() {
  return (
    <ModulePlaceholderScreen
      title="Knowledge bases"
      permission={KNOWLEDGE_BASE_PERMISSIONS.VIEW}
      icon="knowledgeBases"
      description="The documents your agents answer from, and who is allowed to read each set."
    />
  );
}
