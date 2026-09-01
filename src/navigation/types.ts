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

export type ChatStackParamList = {
  ChatHome: undefined;
};

export type MarketplaceStackParamList = {
  MarketplaceHome: undefined;
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
  KnowledgeBases: undefined;
  Playground: undefined;
  Customers: undefined;
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
