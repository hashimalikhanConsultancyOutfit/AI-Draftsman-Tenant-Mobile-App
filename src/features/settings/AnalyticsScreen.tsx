import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';

export function AnalyticsScreen() {
  return (
    <ModulePlaceholderScreen
      mode="stack"
      title="Analytics"
      permission={USAGE_PERMISSIONS.VIEW}
      icon="insights"
      description="How this workspace is being used over time, with CSV export."
    />
  );
}
