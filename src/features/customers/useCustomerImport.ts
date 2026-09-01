/**
 * Customers CSV import — the flow. Ported from the web app's
 * `src/features/Customers/useCustomerImport.tsx` (confirmed against that
 * source). Owns the five-call sequence and everything derived from it —
 * split out of the registry screen because it is a state machine with
 * its own lifetime: the job outlives this screen, and outlives the app.
 *
 *   choose  -> pick a file, checked locally against the ceilings
 *   upload  -> POST it to the gateway, which streams it into storage
 *   check   -> poll while the server validates; nothing is written yet
 *   review  -> every row valid: confirm, or walk away
 *   import  -> poll while the server writes
 *
 * ── THE THREE RULES THIS HOOK EXISTS TO KEEP ─────────────────────────────
 *  1. `canApply` comes from the server. Never re-derived from status here.
 *  2. Leaving the screen does not stop the job — the work is server-side.
 *     Unlike web's dialog, this screen is a stack route: navigating back
 *     unmounts it, and local state (file, jobId, upload progress) dies
 *     with it naturally. There is no separate "close resets state" effect
 *     to forget, because there is nothing left to reset — reopening the
 *     screen is a fresh mount, which is exactly web's post-close state.
 *     The one thing that IS cancelled is an upload still streaming from
 *     this device, via `handleCancelUpload`.
 *  3. The registry is invalidated when the job COMPLETES, not when apply
 *     is accepted — apply answers 202 before a single row is written.
 */
import { skipToken } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '@/components/ui';
import { CsvUploadError, IMPORT_FILE_FIELD, IMPORT_UPLOAD_URL, uploadCsvFile } from '@/services/csvUpload';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

import { customerErrorFallback } from './customersRules';
import { buildCompletedMessage, checkChosenFile, importPhaseOf, importPollInterval, isResumableImport, toImportContentType, type ImportPhase, type PickedCsvFile } from './customerImportRules';
import { customerImportApi, customersChangedByImport, useApplyImportMutation, useGetImportJobQuery, useLazyGetImportErrorReportQuery, useListImportErrorsQuery, useListImportJobsQuery } from './customerImportApi';
import type { ImportJobAccepted } from './customerImport.types';

/** Errors per page in the "show everything" list. The gateway's ceiling is 500. */
export const IMPORT_ERROR_PAGE_SIZE = 50;

/** How many recent jobs to ask for when looking for one to reopen. */
const RECENT_JOBS_LIMIT = 20;

export interface PickedImportFile extends PickedCsvFile {
  /** `file://...` URI from expo-document-picker — read by the upload
   * helper, never sent to the gateway as-is. */
  uri: string;
}

type ImportUploadStep = 'idle' | 'uploading' | 'confirming';

const UPLOAD_STEP_LABEL: Record<ImportUploadStep, string> = {
  idle: '',
  uploading: 'Uploading the file…',
  confirming: 'Upload finished — starting the check…',
};

export function useCustomerImport() {
  const dispatch = useAppDispatch();
  const toast = useToast();

  const [file, setFile] = useState<PickedImportFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const [uploadStep, setUploadStep] = useState<ImportUploadStep>('idle');
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const [showAllErrors, setShowAllErrors] = useState(false);
  const [errorPageNumber, setErrorPageNumber] = useState(1);

  /* Aborts an upload still streaming out of this device. Nothing else is
     cancellable — once the bytes are in storage the job belongs to the server. */
  const abortRef = useRef<AbortController | null>(null);

  const [applyImport, { isLoading: isApplying }] = useApplyImportMutation();
  const [fetchErrorReport, { isFetching: isReportLoading }] = useLazyGetImportErrorReportQuery();

  /* --- Polling -------------------------------------------------------------- */

  const [pollStartedAt, setPollStartedAt] = useState(0);

  const restartPollClock = useCallback(() => {
    setPollStartedAt(Date.now());
  }, []);

  /* `pollingInterval` has to be known BEFORE `useGetImportJobQuery` is
     called, and it depends on the status that call returns — so the
     status is read straight out of the RTK Query cache via the
     endpoint's own selector, the same store state the hook below will
     render from, rather than feeding it back through a state + effect
     round trip. */
  const selectJobEntry = useMemo(() => customerImportApi.endpoints.getImportJob.select(jobId ?? skipToken), [jobId]);
  const jobEntry = useAppSelector(selectJobEntry);

  /* Elapsed time in THIS phase, measured by the polling itself rather
     than a timer — a backgrounded app that is not polling does not
     accrue "waiting" it never did. */
  const pollElapsedMs = pollStartedAt > 0 && (jobEntry.fulfilledTimeStamp ?? 0) > pollStartedAt ? (jobEntry.fulfilledTimeStamp ?? 0) - pollStartedAt : 0;

  const pollingInterval = importPollInterval(jobEntry.data?.status, pollElapsedMs);

  /* `currentData`, not `data` — RTK Query keeps returning the previous
     `data` once an arg becomes `skipToken`, deliberately, so a skipped
     query does not flash empty. `setJobId(null)` (Import another file)
     means "no job on screen"; with `data` the finished job would outlive
     it and the phase would read COMPLETED forever. */
  const {
    currentData: job,
    isLoading: isJobLoading,
    error: jobRequestError,
  } = useGetImportJobQuery(jobId ?? skipToken, {
    pollingInterval,
    refetchOnMountOrArgChange: true,
  });

  /* --- The registry moved --------------------------------------------------- */

  /* Fired once per (job, terminal status) — `job` is a fresh object on
     every poll, so the guard is the key rather than the reference. A
     FAILED job with rows written still counts: those customers are real. */
  const settledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!job) return;
    const key = `${job.jobId}:${job.status}`;
    if (settledRef.current === key) return;

    const written = job.import.importedRows ?? 0;

    if (job.status === 'COMPLETED') {
      settledRef.current = key;
      dispatch(customersChangedByImport());
      toast.show(buildCompletedMessage(written, job.originalFileName), { tone: 'success' });
      return;
    }
    if (job.status === 'FAILED' && written > 0) {
      settledRef.current = key;
      dispatch(customersChangedByImport());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `toast`/`dispatch` are stable.
  }, [job]);

  /* --- Validation errors ---------------------------------------------------- */

  const { currentData: errorPage, isFetching: isErrorPageLoading } = useListImportErrorsQuery(
    { jobId: jobId ?? '', page: errorPageNumber, pageSize: IMPORT_ERROR_PAGE_SIZE },
    { skip: !jobId || !showAllErrors },
  );

  /* --- Jobs worth reopening --------------------------------------------------- */

  /* Skipped while a job is on screen — this list exists so a user who
     left the screen can find the import they started, and there is
     nothing to find while they are looking at it. */
  const { currentData: recentJobs } = useListImportJobsQuery(RECENT_JOBS_LIMIT, { skip: Boolean(jobId) });

  const resumableJobs = useMemo(() => (recentJobs ?? []).filter(isResumableImport), [recentJobs]);

  /* --- Handlers -------------------------------------------------------------- */

  const attachToJob = useCallback(
    (id: string) => {
      setJobId(id);
      setShowAllErrors(false);
      setErrorPageNumber(1);
      settledRef.current = null;
      restartPollClock();
    },
    [restartPollClock],
  );

  const handlePickFile = useCallback((chosen: PickedImportFile | null) => {
    setFile(chosen);
    setFileError(chosen ? checkChosenFile(chosen) : null);
  }, []);

  /** One request turns a chosen file into a running job. No retry: a
   * second attempt re-uploads the whole file and creates a second job
   * for it, so that decision belongs to the person. */
  const handleStart = useCallback(async () => {
    if (!file) return;
    const problem = checkChosenFile(file);
    if (problem) {
      setFileError(problem);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setUploadPercent(null);
    setUploadStep('uploading');

    try {
      const accepted = await uploadCsvFile<ImportJobAccepted>({
        url: IMPORT_UPLOAD_URL,
        field: IMPORT_FILE_FIELD,
        file: { uri: file.uri, name: file.name, type: toImportContentType(file.mimeType) },
        onProgress: setUploadPercent,
        signal: controller.signal,
      });

      /* The last bytes are in, and the server is now creating the job
         and queueing validation before it answers — a bar frozen at
         100% with no caption reads as a stall. */
      setUploadStep('confirming');
      attachToJob(accepted.jobId);
    } catch (error) {
      if (!(error instanceof CsvUploadError && controller.signal.aborted)) {
        const message = error instanceof CsvUploadError ? error.message : 'Could not start the import.';
        toast.show(message, { tone: 'error' });
      }
    } finally {
      abortRef.current = null;
      setUploadStep('idle');
      setUploadPercent(null);
    }
  }, [file, attachToJob, toast]);

  const handleCancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Guarded on `job.canApply` — the server's answer, not ours. */
  const handleApply = useCallback(async () => {
    if (!job?.canApply) return;
    try {
      await applyImport(job.jobId).unwrap();
      restartPollClock();
    } catch (err) {
      toast.show(customerErrorFallback(err as SerializedError, 'start writing those customers'), { tone: 'error' });
    }
  }, [job, applyImport, restartPollClock, toast]);

  /** Back to the file picker, leaving whatever the job did alone. */
  const handleStartOver = useCallback(() => {
    setFile(null);
    setFileError(null);
    setJobId(null);
    setShowAllErrors(false);
    setErrorPageNumber(1);
    settledRef.current = null;
  }, []);

  const handleResumeJob = useCallback(
    (id: string) => {
      setFile(null);
      setFileError(null);
      attachToJob(id);
    },
    [attachToJob],
  );

  const handleShowAllErrors = useCallback(() => {
    setShowAllErrors(true);
    setErrorPageNumber(1);
  }, []);

  const handleErrorPageChange = useCallback((page: number) => {
    setErrorPageNumber(Math.max(1, page));
  }, []);

  /** A short-lived read link to the full CSV report, minted per press —
   * opened in-app rather than fetched, since the link expires in minutes. */
  const handleDownloadReport = useCallback(async () => {
    if (!jobId) return;
    try {
      const report = await fetchErrorReport(jobId).unwrap();
      const WebBrowser = await import('expo-web-browser');
      await WebBrowser.openBrowserAsync(report.url);
    } catch (err) {
      toast.show(customerErrorFallback(err as SerializedError, 'produce the error report'), { tone: 'error' });
    }
  }, [jobId, fetchErrorReport, toast]);

  /* --- Derived --------------------------------------------------------------- */

  const phase: ImportPhase = useMemo(() => {
    if (uploadStep !== 'idle') return 'uploading';
    /* `jobId` decides whether a job is on screen, checked BEFORE `job` —
       local state is what the buttons change, so nothing derived from
       the query cache may outrank it. */
    if (!jobId) return 'choose';
    if (job) return importPhaseOf(job.status);
    /* The job exists but its first poll has not answered yet. */
    return 'validating';
  }, [uploadStep, job, jobId]);

  const jobError = useMemo(() => {
    if (!jobRequestError) return null;
    return customerErrorFallback(jobRequestError, 'read the status of that import');
  }, [jobRequestError]);

  return {
    phase,
    file,
    fileError,
    handlePickFile,
    handleStart,

    uploadPercent,
    uploadStepLabel: UPLOAD_STEP_LABEL[uploadStep],
    isUploading: uploadStep !== 'idle',
    handleCancelUpload,

    job: job ?? null,
    isJobLoading: isJobLoading && !job,
    jobError,
    isApplying,
    handleApply,

    errorPage: errorPage ?? null,
    errorPageNumber,
    errorPageSize: IMPORT_ERROR_PAGE_SIZE,
    isErrorPageLoading,
    isShowingAllErrors: showAllErrors,
    handleShowAllErrors,
    handleErrorPageChange,
    isReportLoading,
    handleDownloadReport,

    resumableJobs,
    handleResumeJob,

    handleStartOver,
  };
}

export default useCustomerImport;
