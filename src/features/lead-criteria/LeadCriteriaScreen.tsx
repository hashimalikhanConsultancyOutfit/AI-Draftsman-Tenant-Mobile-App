import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { LEAD_CRITERIA_PERMISSIONS } from '@/permissions/slugs';

export function LeadCriteriaScreen() {
  return (
    <ModulePlaceholderScreen
      title="Lead criteria"
      permission={LEAD_CRITERIA_PERMISSIONS.VIEW}
      icon="leadCriteria"
      description="Named sets of firmographic, contact and signal filters that describe what your team is chasing."
    />
  );
}
