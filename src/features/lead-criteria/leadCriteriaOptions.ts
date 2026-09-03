/**
 * Static option lists for the Lead criteria form — ported verbatim from
 * web's `LeadCriteriaFormDialog.data.ts`. Closed dropdowns rather than
 * open typing, matching every multi-select on that form. A value already
 * stored that predates this list still round-trips correctly; it simply
 * has no matching option to show a label for.
 */
import type { LeadFundingStage, LeadSeniority } from './leadCriteria.types';

export const LEAD_SENIORITY_LABELS: Record<LeadSeniority, string> = {
  FOUNDER: 'Founder',
  OWNER: 'Owner',
  C_LEVEL: 'C-level',
  VP: 'VP',
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  SENIOR: 'Senior',
  ENTRY: 'Entry-level',
};

export const LEAD_FUNDING_STAGE_LABELS: Record<LeadFundingStage, string> = {
  BOOTSTRAPPED: 'Bootstrapped',
  PRE_SEED: 'Pre-seed',
  SEED: 'Seed',
  SERIES_A: 'Series A',
  SERIES_B: 'Series B',
  SERIES_C_PLUS: 'Series C+',
  PRIVATE_EQUITY: 'Private equity',
  PUBLIC: 'Public',
};

const INDUSTRIES = [
  'Technology & Software', 'Financial Services', 'Banking', 'Insurance', 'Healthcare & Life Sciences',
  'Pharmaceuticals & Biotechnology', 'Manufacturing', 'Retail & E-commerce', 'Wholesale & Distribution',
  'Construction', 'Real Estate', 'Education', 'Hospitality & Leisure', 'Transportation & Logistics',
  'Energy & Utilities', 'Telecommunications', 'Media & Entertainment', 'Professional & Business Services',
  'Legal Services', 'Marketing & Advertising', 'Recruitment & HR', 'Non-profit & Charity',
  'Government & Public Sector', 'Agriculture & Farming', 'Automotive', 'Consumer Goods', 'Food & Beverage',
  'Aerospace & Defence', 'Mining & Metals', 'Chemicals', 'Sports & Recreation', 'Social Care',
];
export const INDUSTRY_OPTIONS = INDUSTRIES.map((value) => ({ label: value, value }));

const REGIONS = [
  'Global', 'North America', 'United States', 'Canada', 'Latin America', 'Central America', 'South America',
  'Caribbean', 'Europe', 'UK & Ireland', 'Western Europe', 'Eastern Europe', 'Northern Europe', 'Southern Europe',
  'DACH (Germany, Austria, Switzerland)', 'Benelux', 'Nordics', 'Middle East', 'North Africa',
  'Sub-Saharan Africa', 'Africa', 'Asia', 'East Asia', 'South Asia', 'Southeast Asia', 'Central Asia', 'Oceania',
  'Australia & New Zealand', 'EMEA', 'APAC', 'LATAM',
];
export const REGION_OPTIONS = REGIONS.map((value) => ({ label: value, value }));

const COMPANY_TYPES = [
  'Private Limited Company', 'Public Limited Company', 'Sole Trader / Sole Proprietorship', 'Partnership',
  'Limited Liability Partnership (LLP)', 'Limited Liability Company (LLC)', 'Corporation', 'S-Corporation',
  'C-Corporation', 'Non-profit / Charity', 'Government Entity', 'Startup', 'Small & Medium Enterprise (SME)',
  'Enterprise / Large Corporate', 'Franchise', 'Subsidiary', 'Holding Company', 'Cooperative', 'Trust',
  'Family Business',
];
export const COMPANY_TYPE_OPTIONS = COMPANY_TYPES.map((value) => ({ label: value, value }));

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia',
  'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
  'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad',
  'Chile', 'China', 'Colombia', 'Comoros', 'Congo (Republic of the)', 'Congo (Democratic Republic of the)',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
  'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada',
  'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho',
  'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
  'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco',
  'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands',
  'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan',
  'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden',
  'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];
export const COUNTRY_OPTIONS = COUNTRIES.map((value) => ({ label: value, value }));

export const SENIORITY_OPTIONS = (Object.keys(LEAD_SENIORITY_LABELS) as LeadSeniority[]).map((value) => ({ label: LEAD_SENIORITY_LABELS[value], value }));
export const FUNDING_STAGE_OPTIONS = (Object.keys(LEAD_FUNDING_STAGE_LABELS) as LeadFundingStage[]).map((value) => ({ label: LEAD_FUNDING_STAGE_LABELS[value], value }));
export const STATUS_OPTIONS = [{ label: 'Active', value: 'ACTIVE' }, { label: 'Archived', value: 'ARCHIVED' }];
