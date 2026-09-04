import * as yup from 'yup';

/** Add an internal note. Mirrors `AddNoteDto`: required, 1..20,000. */
export const noteSchema = yup.object({
  body: yup.string().trim().required('A note needs something in it.').max(20_000, 'That is too long.'),
});

export type NoteFormValues = yup.InferType<typeof noteSchema>;
