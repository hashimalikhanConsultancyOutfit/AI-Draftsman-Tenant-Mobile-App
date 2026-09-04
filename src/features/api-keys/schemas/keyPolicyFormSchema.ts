import * as yup from 'yup';

import { IPV4_CIDR_SHAPE, MAX_IP_ALLOWLIST_ENTRIES, parseIpAllowlist } from '../apiKeysRules';

/**
 * Mirrors `CreateKeyPolicyDto`/`UpdateKeyPolicyDto` exactly on bounds
 * (`apps/gateway-b2b/src/app/api-keys/dto/api-key.dto.ts`, confirmed
 * 2026-09-03): `requestsPerMinute` 0-1,000,000, `tokensPerMinute`
 * 0-100,000,000, both required integers (0 means unlimited). `budget` is
 * entered in pounds here and converted to integer minor units (pence) on
 * submit — the server field itself, `budgetMinor`, is already an integer
 * and never a float.
 *
 * `ipAllowlist` is validated client-side only as a light IPv4 CIDR shape
 * check — a disclosed, narrower stand-in for the server's real CIDR
 * parser (which also accepts IPv6). See the module spec for why.
 */
export const keyPolicyFormSchema = yup.object({
  name: yup.string().trim().min(1, 'Enter a name.').max(120, 'Keep it under 120 characters.').required('Enter a name.'),
  scopeType: yup.string().oneOf(['ALL_MODELS_ALL_AGENTS', 'CHEAP_MODELS_ONLY', 'CUSTOMER_SCOPED']).required(),
  budget: yup
    .string()
    .required('Enter a spend cap.')
    .test('is-number', 'Enter a whole or decimal amount, 0 or more.', (v) => v !== undefined && v.trim() !== '' && !Number.isNaN(Number(v)) && Number(v) >= 0),
  budgetResetCadence: yup.string().oneOf(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).required(),
  requestsPerMinute: yup
    .string()
    .required('Enter a requests-per-minute limit.')
    .test('bounds', 'Whole number from 0 to 1,000,000.', (v) => /^\d+$/.test(v ?? '') && Number(v) <= 1_000_000),
  tokensPerMinute: yup
    .string()
    .required('Enter a tokens-per-minute limit.')
    .test('bounds', 'Whole number from 0 to 100,000,000.', (v) => /^\d+$/.test(v ?? '') && Number(v) <= 100_000_000),
  ipAllowlist: yup
    .string()
    .optional()
    .test('cidr-shape', 'Use comma-separated CIDR ranges, e.g. 203.0.113.0/24. Leave empty to allow any address.', (v) => {
      if (!v || !v.trim()) return true;
      return parseIpAllowlist(v).every((entry) => IPV4_CIDR_SHAPE.test(entry));
    })
    .test('cidr-count', `Enter at most ${MAX_IP_ALLOWLIST_ENTRIES} addresses.`, (v) => {
      if (!v || !v.trim()) return true;
      return parseIpAllowlist(v).length <= MAX_IP_ALLOWLIST_ENTRIES;
    }),
  allowTraining: yup.boolean().required(),
  isDefault: yup.boolean().required(),
});

export type KeyPolicyFormValues = yup.InferType<typeof keyPolicyFormSchema>;
