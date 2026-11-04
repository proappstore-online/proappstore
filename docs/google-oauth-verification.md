# Google OAuth verification

Prepared 2026-11-05. Submission and approval are **not yet confirmed**. This is
the submission checklist for removing Google's unverified-app warning from
ProAppStore's Calendar/Meet connection.

## Evidence and scope

The platform's ordinary Google sign-in requests `openid email profile` in
`platform/packages/backend/src/routes/auth.ts`. The optional Calendar/Meet
connector uses the same `GOOGLE_CLIENT_ID` and requests the scopes below in
`platform/packages/backend/src/lib/google-calendar-common.ts`.

Do not remove connector scopes just to hide the warning: the implemented features
need them. Publishing an app to production is not scope approval. Google must
verify the sensitive scopes before the public connection can lose the warning.

## Console checklist

Use the Google Cloud project containing the **deployed PAS OAuth client**, rather
than assuming the Cloud console's last-selected project is correct. Compare its
public client ID with the `client_id` on the PAS Google sign-in redirect.

- [ ] Confirm the project's current publishing and verification status.
- [ ] Confirm brand name, support email, and developer contacts are current.
- [ ] Set homepage to `https://proappstore.online/` and privacy policy to
      `https://proappstore.online/privacy`; use the same policy URL as the homepage.
- [ ] Confirm `proappstore.online` ownership in Google Search Console using a
      Google account that is an owner/editor of this Cloud project.
- [ ] Confirm both existing sign-in and connector callback URLs remain registered.
      The connector callback is
      `https://api.proappstore.online/v1/connectors/google-calendar/callback`.
- [ ] Confirm Calendar API and Google Meet REST API are enabled.
- [ ] Reconcile Data access with the exact requested scopes below. Do not add
      unrelated Gmail, Drive, Calendar write, or Meet recording scopes.
- [ ] Review the live homepage, privacy policy, and in-app connection notice for
      consistent descriptions of the actual feature, data use, audience, storage,
      retention/deletion and disconnect behavior. App-specific retained attendance
      records need an accessible app-specific notice; the platform policy alone
      does not establish that notice or a retention period.
- [ ] Add a demonstration video and per-scope justifications in Verification centre.
- [ ] Submit the completed request and record Google's case/status here.
- [ ] After approval, test a fresh Calendar/Meet connection and confirm the warning
      has disappeared. Approval cannot be inferred from a successful test-user grant.

## Draft scope justifications

Review these against the demonstrated app before submitting.

| Requested scope | User-facing purpose and why narrower access does not suffice |
| --- | --- |
| `openid`, `email` | Identify the Google account connected to PAS and show its email in connection settings. These identity permissions alone do not authorize Calendar or Meet reads. |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | List the user's readable calendars so they can explicitly select a calendar, including a shared organization calendar. Read the selected calendar's name and access role to validate the grant. Events-only access cannot provide the calendar picker or validate the calendar-list entry. No calendar-list modification is needed. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Display selected-calendar meetings and recurring occurrences, including titles, times, cancellation status and Meet links. Use the exact event to constrain the related Meet conference lookup. Calendar-list access does not provide events. Owned-calendar-only scopes would exclude shared calendars the user can read. No event editing is needed. |
| `https://www.googleapis.com/auth/meetings.space.readonly` | Read conference records, participant identities and participant-session join/leave times for meetings discovered through selected-calendar events. Show actual attendance rather than treating an invitation or RSVP as proof. Calendar scopes do not provide these attendance records. Access limited to app-created spaces would exclude existing meetings created outside PAS. No meeting creation, modification, recording or transcript access is needed. |

Source evidence: `platform/packages/backend/src/lib/google-calendar-accounts.ts`
stores encrypted tokens and app-specific authorization; `google-calendar-data.ts`
implements the calendar picker, event fields, conference lookup and participant
sessions. `disconnectGoogleAccount` clears credentials and identity and invalidates
grants; it does not delete records an app has already saved or revoke the Google-side
grant. Revoking in Google Account connections is a separate user control.

## Demonstration video plan

Use a dedicated demonstration account and calendar containing synthetic meeting
and participant data. Do not upload real internship, recruiting or other private
attendance records as review evidence.

1. Show ProAppStore's homepage, privacy policy and the app's Google-data notice.
2. Open the app's connection settings as an authorized organization owner.
3. Start the Google connection, showing the consent flow in English and every
   requested scope. The reviewer must be able to see the app name and scope list.
4. Return to the app, show the connected email and calendar picker, select the
   demonstration shared calendar, and save it.
5. Show meetings from that calendar and a completed Meet conference's participants
   and session times. Explain the relationship between each permission and what
   appears in the product.
6. Show grant revocation/disconnect controls and explain the difference between
   stopping future reads and deleting retained attendance records.

Record and upload the video only with the account owner's authorization. Keep the
review link accessible to Google's reviewers and add it to the submission; do not
include credentials, OAuth codes or refresh tokens in the recording.

## Google references

- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Verification requirements](https://support.google.com/cloud/answer/13464321?hl=en)
- [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [Calendar scope definitions](https://developers.google.com/workspace/calendar/api/auth)
- [Meet scope definitions and sensitivity](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize)
