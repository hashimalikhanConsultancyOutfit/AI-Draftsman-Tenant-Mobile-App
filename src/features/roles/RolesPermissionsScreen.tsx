import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { ROLE_PERMISSIONS } from '@/permissions/slugs';

export function RolesPermissionsScreen() {
  return (
    <ModulePlaceholderScreen
      title="Roles & permissions"
      permission={ROLE_PERMISSIONS.VIEW}
      icon="rolesAndPermissions"
      description="What each role in this workspace may do. Assigning a person to a role is done from Team."
    />
  );
}
