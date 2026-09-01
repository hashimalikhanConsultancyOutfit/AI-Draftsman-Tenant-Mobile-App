import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { TEAM_PERMISSIONS } from '@/permissions/slugs';

export function TeamScreen() {
  return (
    <ModulePlaceholderScreen
      title="Team"
      permission={TEAM_PERMISSIONS.VIEW}
      icon="team"
      description="Who can reach this workspace, and what each of them may do."
    />
  );
}
