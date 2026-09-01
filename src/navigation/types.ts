import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  OtpVerify: undefined;
  TotpEnrolment: undefined;
  RecoveryCodes: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  AccountRefused: undefined;
  OnboardingIncomplete: undefined;
};

// ── Per-tab stacks ──────────────────────────────────────────────────────────

export type DashboardStackParamList = {
  DashboardHome: undefined;
  /* All three carry the month the user had selected on the Dashboard when
     they tapped "See all" — so the detail screen shows the same period,
     not always the current month. */
  SpendByDay: { period: string };
  TopBySpend: { period: string };
  RecentRuns: { period: string };
  /** `CustomerFormScreen` reused in-place from the Customers stack — the
     dashboard's "Register customer" quick action and empty-state CTA
     open it inline rather than jumping across to the Customers drawer
     screen, same convention as MarketplaceStack reusing AgentFormScreen. */
  CustomerForm: { id?: string };
  /** `AgentFormScreen` reused in-place from the Company Agents stack —
     the dashboard's "Create agent" quick action opens it inline rather
     than switching tabs, same convention as CustomerForm above. */
  AgentForm: { id?: string };
};

export type CompanyAgentsStackParamList = {
  CompanyAgentsHome: undefined;
  AgentDetail: { id: string };
  AgentForm: { id?: string };
  AgentCloneOut: { id: string };
};

export type CustomerAgentsStackParamList = {
  CustomerAgentsHome: undefined;
  CloneDetail: { id: string };
  CloneEdit: { id: string };
};

export type KnowledgeBasesStackParamList = {
  KnowledgeBasesHome: undefined;
  KnowledgeBaseDetail: { id: string };
  KnowledgeBaseEdit: { id?: string };
  KnowledgeBaseUpload: { id: string };
};

export type ChatStackParamList = {
  ChatHome: undefined;
};

export type CustomersStackParamList = {
  CustomersHome: undefined;
  CustomerDetail: { id: string };
  /** No id = register, id present = edit — mirrors AgentForm's convention. */
  CustomerForm: { id?: string };
  CustomerSuspend: { id: string };
  /** The CSV bulk-import flow (its own multi-phase job) — a modal route,
     opened from the registry's header action. */
  CustomerImport: undefined;
};

export type MarketplaceStackParamList = {
  MarketplaceHome: undefined;
  ConnectorDetail: { slug: string };
  MarketplaceEntryDetail: { resource: 'skill' | 'agent'; id: string };
  OwnedSkillDetail: { catalogueId: string };
  AddSkill: undefined;
  /* Reuses Company Agents' own detail/edit/clone-out screens in place, the
     same way web's OwnedAgentsPanel reuses those dialogs rather than
     navigating away — opening, editing, or cloning out an agent from the
     marketplace must not leave the Marketplace tab. */
  AgentForm: { id?: string };
  AgentDetail: { id: string };
  AgentCloneOut: { id: string };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Appearance: undefined;
  Account: undefined;
  UsageCredits: undefined;
  Analytics: undefined;
};

/** The bottom tab bar — five tabs, permission-composed (a tab whose VIEW
 * grant is absent is simply not rendered; Settings always is, mirroring the
 * web's ungated `/settings`). */
export type AppTabParamList = {
  DashboardTab: undefined;
  CompanyAgentsTab: undefined;
  ChatTab: undefined;
  MarketplaceTab: undefined;
  SettingsTab: undefined;
};

/** Everything reachable from the sidebar, plus the tab bar itself as one
 * drawer screen. Each module route below is its own stack so a module can
 * grow nested screens without touching this list again. */
export type AppDrawerParamList = {
  /* Optionally jumps straight to a tab (e.g. the sidebar's own "Dashboard"
     row) — undefined lands on whichever tab react-navigation already has
     active, same as before this carried params. */
  MainTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  CustomerAgents: NavigatorScreenParams<CustomerAgentsStackParamList> | undefined;
  KnowledgeBases: NavigatorScreenParams<KnowledgeBasesStackParamList> | undefined;
  Playground: undefined;
  Customers: NavigatorScreenParams<CustomersStackParamList> | undefined;
  Leads: undefined;
  LeadCriteria: undefined;
  Reports: undefined;
  UsageSpend: undefined;
  ApiKeys: undefined;
  Team: undefined;
  RolesPermissions: undefined;
  OrganizationSettings: undefined;
  Support: undefined;
};

/** Kept for the root navigator's type surface — the drawer is what actually
 * mounts once `phase === 'authenticated'`. */
export type AppStackParamList = AppDrawerParamList;
