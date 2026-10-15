# Surveys — mobile module spec

Ported from web `/surveys` (`ai-draftsman-FE-B2B/src/features/Survey/**`, `store/api/surveys.api.ts`) and checked against the live gateway on 2026-10-15.

## Where
Sidebar → RUN → **Surveys** (right after Usage & spend). Subtitle "Build, target and review in-app surveys", icon `poll`, permission `survey.manage` (`SURVEY_PERMISSIONS.MANAGE`).

## Files
- `src/features/surveys/` — `surveys.types.ts`, `surveysApi.ts`, `surveysRules.ts` (all pure rules + copy), `schemas/surveyFormSchemas.ts`, `useSurveyDraftChat.ts`
- Screens: `SurveysScreen` (list / tube map), `SurveyWizardScreen` (New survey), `SurveyDetailScreen` (tabs), `SurveyScheduleFormScreen` (modal)
- Components: `SurveyCard`, `SurveyTubeMap`, `SurveyDetailsFields`, `SurveyAudienceSection`, `AudiencePicker`, `SurveyScheduleSection`, `SurveyFormEditor`, `SurveyFormRenderer`, `SurveyAiDraftSheet`, `SurveyOverview`, `SurveyResponses`, `SurveySheet`, `Panel`
- Navigation: `navigation/stacks/SurveysStack.tsx`, `SurveysStackParamList` + drawer route `Surveys` in `types.ts`, `AppDrawer`, `sidebarConfig`
- Shared edits: `store/api.ts` tag types (`Survey`, `SurveySchedule`, `SurveyRun`, `SurveyResponse`, `SurveyDashboard`, `SurveyAudience`, `WorkspaceMember`), `Icon.tsx` (`surveys: 'poll'`), `slugs.ts`, `TagChip` gained a `danger` tone.

## Behaviour (as web)
- **List**: status filter (All/Draft/Active/Paused/Archived; tones neutral/success/warning/danger), cursor pages of 20 behind "Load more", card shows title, status, description, Evaluation (AI/Manual), Created, View. Empty "No surveys yet"; error "Could not load surveys".
- **Tube map**: `GET /surveys/map`, seven stages (Survey → Form → Audience → Delivery → Responses → Review → Result) with web's stop logic; drawn as one vertical line per survey. The endpoint currently answers 500 on live, so the error state shows — same as web.
- **New survey wizard**: Details → Audience & Schedule → Survey Form. Survey is created (empty schema, MANUAL default) when leaving Details via Next or Finish later; empty title → "Give the survey a title before continuing." Details lock once created. Form's save is labelled "Finish" and lands on the survey page.
- **Detail tabs**: Overview (stat tiles, by-status chips, recent runs), Details (save enabled only when dirty, sends only changed fields), Survey Form, Audience & Schedule (+ Send now), Responses.
- **Form editor**: sections as blocks (move up/down, remove with confirm), fields within a section (move, remove), kind picker (no "Section heading"), select/multiselect need ≥2 options ("Options (n/2 minimum)"), rating stores 1–5. Keys slugified from the first label and never change after. Save → new version; blocked reasons exactly web's.
- **Generate with AI**: own `/survey-draft-chat` socket while the sheet is open (session cookie value as `auth.token`), restores history, uploads attachments immediately (send blocked while uploading), whole thread sent on every `draft:send`. Draft card: up to 6 fields then "+N more", Use this draft / Preview. Over existing fields → "Replace the current fields?" confirm. Deviation: error turns are not resent to the model.
- **Audience**: four rule types; specific users (`/onboarding/invites`) or customers checklist with Select all / Clear (a search box added for phones). Send now blocked without a saved audience or when archived; confirm shows fresh eligible/skipped, skip reasons and an active-schedule warning.
- **Schedule**: one-time (typed `YYYY-MM-DD` + `HH:MM`, must be future — checked client-side before any request) or recurring (Daily/Weekly/Monthly/Custom cron, ends never/by date (23:59 in zone)/after N). Edit seeds recurring as CUSTOM with the stored cron. "{Label} is required" for every visible field. Zone conversion uses the zoned wall clock rather than `shortOffset` (Hermes support).
- **Responses**: rows with answers count and Reviewed/Rating (manual) or Score/Sentiment (AI); sheet shows answers labelled from the version answered; manual review (Reviewed, Rating 1–5, Notes) or AI evaluation polled every 4 s until DONE/FAILED.

## Not available
No delete endpoint for surveys — archive via Status. No test surveys were created on live for that reason.

## Tests
`surveysRules.ts` and the schedule schema have node tests (editor ops, blocked reasons, draft apply, timezone conversion incl. DST, schedule request/seed, send copy, tube stops). Typecheck clean.

---

# My Surveys — the respondent's side

Ported from web `/my-surveys` (`features/MySurveys/**`, `store/api/mySurveys.api.ts`).

## Where
Sidebar → RUN → **My Surveys**, right after Surveys. Subtitle "Surveys assigned to you", icon `assignment`, permission `survey.respond` (seeded to every tenant user, so effectively everyone; the backend scopes reads to the caller).

## Files
`features/surveys/mySurveysApi.ts`, `mySurveysRules.ts`, `MySurveysScreen.tsx`, `MySurveyFillScreen.tsx`, `components/MySurveyCard.tsx`, `components/MySurveyTubeMap.tsx`; `navigation/stacks/MySurveysStack.tsx`; `MySurveysStackParamList` + drawer route `MySurveys`; tag `MySurvey`. `SurveyFormRenderer` now has a controlled mode (values / onChange / errors / disabled) shared with the manager's Preview; rating answers are numbers 1–5, as on web.

## Behaviour (as web)
- **List** (`GET /my/surveys`, cursor, 20 per page, "Load more"): title with an unread dot and bold title while New/Seen, status (New warning, Seen info, In progress info, Completed success, Expired neutral), Due (relative), action Fill in / View. Empty "Nothing assigned / Surveys sent to you will show up here."; error "Could not load your surveys".
- **Tube map** (`GET /my/surveys/map`): Survey → Opened → State → Due → Tally with web's stop logic (Overdue, Closed, expired reasons). Read-only.
- **Fill** (`GET /my/surveys/:id`): a PENDING assignment is marked seen once (`PATCH`). Not completed → the form; Submit checks every required question ("{Label} is required" — text trimmed, multiselect ≥1, rating picked, Yes/No picked) and posts one answer per non-section field (`POST :id/responses`), toast "Response submitted. Thank you!", back to the list. Completed → "You already submitted this survey on {date}." and the submitted answers. Error → "Could not load this survey."

## Not live-tested
The test account has no assignments (list and map both answer 200 with nothing), and creating one means sending a real survey to its audience — so the fill flow is built from the web source and unit-tested, not exercised on live.
