import {
  CLONE_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  DASHBOARD_PERMISSIONS,
  KEY_PERMISSIONS,
  KNOWLEDGE_BASE_PERMISSIONS,
  LEAD_CRITERIA_PERMISSIONS,
  LEAD_PERMISSIONS,
  BILLING_PERMISSIONS,
  PLAYGROUND_PERMISSIONS,
  REPORT_PERMISSIONS,
  ROLE_PERMISSIONS,
  SUPPORT_PERMISSIONS,
  TEAM_PERMISSIONS,
  USAGE_PERMISSIONS,
} from '@/permissions/slugs';
import type { NavIconKey } from '@/components/ui';
import type { AppDrawerParamList } from './types';

/**
 * Mirrors the web sidebar's information architecture
 * (ai-draftsman-FE-B2B/src/config/navigation.data.ts) — same three groups,
 * same order — trimmed to the module list approved for this app: four of
 * the five bottom-tab items (Company agents, Chat, Marketplace, Settings)
 * are not repeated here, and Getting started / Branding & domain / Audit
 * log are out of scope per that approval. Dashboard IS repeated — see
 * `DASHBOARD_SIDEBAR_ITEM` below — same as the web sidebar, which lists it
 * standalone above BUILD rather than inside a group.
 */
export interface SidebarItem {
  route: keyof AppDrawerParamList;
  label: string;
  subtitle: string;
  icon: NavIconKey;
  permission: string;
}

/** Rendered on its own, above the three grouped sections — see
 * SidebarContent.tsx. Its route is the drawer's tab-bar screen, jumped
 * straight to the Dashboard tab via nested params rather than a flat
 * `navigate(route)` like every other item here, since "Dashboard" has no
 * stack of its own outside the tab bar. */
export const DASHBOARD_SIDEBAR_ITEM: SidebarItem = {
  route: 'MainTabs',
  label: 'Dashboard',
  subtitle: 'Activity, spend and recent runs at a glance',
  icon: 'dashboard',
  permission: DASHBOARD_PERMISSIONS.VIEW,
};

export interface SidebarSection {
  id: 'build' | 'run' | 'setup';
  label: string;
  items: SidebarItem[];
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: 'build',
    label: 'BUILD',
    items: [
      {
        route: 'CustomerAgents',
        label: 'Customer agents',
        subtitle: 'Agent clones deployed to your customers',
        icon: 'customerAgents',
        permission: CLONE_PERMISSIONS.VIEW,
      },
      {
        route: 'KnowledgeBases',
        label: 'Knowledge bases',
        subtitle: 'Documents and sources your agents draw on',
        icon: 'knowledgeBases',
        permission: KNOWLEDGE_BASE_PERMISSIONS.VIEW,
      },
      {
        route: 'Playground',
        label: 'Playground',
        subtitle: 'Try prompts before you ship them',
        icon: 'playground',
        permission: PLAYGROUND_PERMISSIONS.VIEW,
      },
    ],
  },
  {
    id: 'run',
    label: 'RUN',
    items: [
      {
        route: 'Customers',
        label: 'Customers',
        subtitle: 'Organisations you serve',
        icon: 'customers',
        permission: CUSTOMER_PERMISSIONS.VIEW,
      },
      {
        route: 'Leads',
        label: 'Leads',
        subtitle: 'Pipeline of prospective customers',
        icon: 'leads',
        permission: LEAD_PERMISSIONS.VIEW,
      },
      {
        route: 'LeadCriteria',
        label: 'Lead criteria',
        subtitle: 'Search criteria and scoring rules for your pipeline',
        icon: 'leadCriteria',
        permission: LEAD_CRITERIA_PERMISSIONS.VIEW,
      },
      {
        route: 'Reports',
        label: 'Reports',
        subtitle: 'Exportable views of agent activity',
        icon: 'reports',
        permission: REPORT_PERMISSIONS.VIEW,
      },
      {
        route: 'UsageSpend',
        label: 'Usage & spend',
        subtitle: 'Consumption and cost breakdown',
        icon: 'usageAndSpend',
        permission: USAGE_PERMISSIONS.VIEW,
      },
    ],
  },
  {
    id: 'setup',
    label: 'SETUP',
    items: [
      {
        route: 'ApiKeys',
        label: 'API keys',
        subtitle: 'Programmatic access to the platform',
        icon: 'apiKeys',
        permission: KEY_PERMISSIONS.VIEW,
      },
      {
        route: 'Team',
        label: 'Team',
        subtitle: 'People and their roles',
        icon: 'team',
        permission: TEAM_PERMISSIONS.VIEW,
      },
      {
        route: 'RolesPermissions',
        label: 'Roles & permissions',
        subtitle: 'What each role in this workspace may do',
        icon: 'rolesAndPermissions',
        permission: ROLE_PERMISSIONS.VIEW,
      },
      {
        route: 'OrganizationSettings',
        label: 'Organization settings',
        subtitle: 'What a credit costs you, and what you charge for one',
        icon: 'organizationSettings',
        permission: BILLING_PERMISSIONS.VIEW,
      },
      {
        route: 'Support',
        label: 'Support',
        subtitle: 'Raise and track tickets',
        icon: 'support',
        permission: SUPPORT_PERMISSIONS.VIEW,
      },
    ],
  },
];
