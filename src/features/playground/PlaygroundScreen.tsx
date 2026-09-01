import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { PLAYGROUND_PERMISSIONS } from '@/permissions/slugs';

export function PlaygroundScreen() {
  return (
    <ModulePlaceholderScreen
      title="Playground"
      permission={PLAYGROUND_PERMISSIONS.VIEW}
      icon="playground"
      description="Try a system prompt against a use case before you ship it as an agent."
    />
  );
}
