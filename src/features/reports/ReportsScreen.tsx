import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { REPORT_PERMISSIONS } from '@/permissions/slugs';

export function ReportsScreen() {
  return (
    <ModulePlaceholderScreen
      title="Reports"
      permission={REPORT_PERMISSIONS.VIEW}
      icon="reports"
      description="Scheduled exports of agent activity, delivered on a cadence you set."
    />
  );
}
