import * as yup from 'yup';

/** Suspend is a FORM dialog, not a bare confirm — the gateway 400s on a
 * blank reason, since it's recorded against the customer and the audit
 * trail. */
export const suspendCustomerSchema = yup.object({
  reason: yup.string().trim().required('A reason is required'),
});

export type SuspendCustomerFormValues = yup.InferType<typeof suspendCustomerSchema>;
