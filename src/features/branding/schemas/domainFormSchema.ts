import * as yup from 'yup';

/**
 * Connect a domain. Mirrors `AddDomainDto`'s own shape checks (confirmed
 * against that source 2026-09-04) — non-empty, at most 253 characters
 * (the DNS ceiling). The backend does the real validation (a usable
 * public hostname, not an IP literal or a platform subdomain) and answers
 * 400 with a specific reason; this only catches the obvious slips —
 * pasting a full URL or leaving a path on — before a round trip.
 */
export const domainFormSchema = yup.object({
  hostname: yup
    .string()
    .trim()
    .required('Enter the domain you want to connect.')
    .max(253, 'That is longer than a hostname can be.')
    .test('no-scheme', 'Enter just the hostname, without https:// at the front.', (value) => !value || !/^[a-z]+:\/\//i.test(value))
    .test('no-path', 'Enter just the hostname, without a path or trailing slash.', (value) => !value || !value.includes('/'))
    .test('no-space', 'A hostname cannot contain spaces.', (value) => !value || !/\s/.test(value)),
});

export type DomainFormValues = yup.InferType<typeof domainFormSchema>;
