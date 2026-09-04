import * as yup from 'yup';

import { HEX_COLOUR_MESSAGE, HEX_COLOUR_PATTERN } from '../brandingRules';

/**
 * Edit brand. Mirrors `UpdateBrandingDto` (confirmed against that source
 * 2026-09-04): both colours are hex, required (the palette is sent
 * complete or not at all — see `BrandFormScreen`'s submit), font is one
 * of the backend's `FONT_LABELS`, powered is a plain boolean. The logo is
 * NOT a schema field — it is a separately-managed picked-file slot, since
 * an untouched picker must submit no file at all rather than an empty
 * string.
 */
export const brandFormSchema = yup.object({
  primary: yup.string().trim().required('Enter a primary colour.').matches(HEX_COLOUR_PATTERN, HEX_COLOUR_MESSAGE),
  accent: yup.string().trim().required('Enter an accent colour.').matches(HEX_COLOUR_PATTERN, HEX_COLOUR_MESSAGE),
  font: yup.string().trim().required('Choose a font.'),
  powered: yup.boolean().default(true),
});

export type BrandFormValues = yup.InferType<typeof brandFormSchema>;
