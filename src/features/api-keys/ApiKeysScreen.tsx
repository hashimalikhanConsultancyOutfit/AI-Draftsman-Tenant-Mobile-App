import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { KEY_PERMISSIONS } from '@/permissions/slugs';

export function ApiKeysScreen() {
  return (
    <ModulePlaceholderScreen
      title="API keys"
      permission={KEY_PERMISSIONS.VIEW}
      icon="apiKeys"
      description="Programmatic access to the platform, each key issued against a policy."
    />
  );
}
