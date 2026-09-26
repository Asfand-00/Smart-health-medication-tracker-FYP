# MedTracker Mobile — Feature Inventory

Every feature found in the web application (`frontend/src`) and backend
(`backend/src`), with its mobile implementation and verified status.

**Statuses**

- **Tested** — implemented and exercised end to end against the real backend
  (see *How it was tested*).
- **Implemented** — code complete and type-checked, but not exercised on the
  platform where it matters (usually a real phone).
- **Blocked** — cannot be implemented without backend work; nothing fake was shipped.
- **Not Applicable** — the web app does not have this.

---

## How it was tested

| Check | Result |
|---|---|
| `tsc --noEmit` (strict) | passes |
| `expo-doctor` | 21/21 checks pass |
| `expo export --platform android` / `ios` | Hermes bundles build (Metro resolves every module for native) |
| API contract test — every endpoint in `src/api/services.ts` with the payloads the screens send, against the real backend + MongoDB | 88/88 pass (includes role 403s, 401 handling, CSV export, Socket.io events) |
| UI — the app's react-native-web build in a 375×812 phone viewport, driven against the real backend | every screen loaded; create/edit/delete flows exercised as listed below |

**Not tested:** no Android emulator, iOS simulator or physical phone was available on the
machine used, so nothing below has run on a real device. Items that behave differently on
a device (SecureStore, native date picker, dialer, share sheet, PDF printing, speech,
background/foreground socket reconnect, keyboard avoidance) are marked accordingly. Running
through the checklist at the end on a phone with Expo Go is the remaining verification step.

---

## Authentication & session

**Feature:** Login
**Existing Web Location:** `pages/auth/LoginPage.jsx`, `context/AuthContext.jsx`
**Mobile Location:** `src/app/login.tsx`, `src/context/AuthContext.tsx`
**API:** `POST /api/auth/login`
**Dependencies:** axios, expo-secure-store
**Implementation:** same client validation and messages; 401 → "Invalid email or password" on the field + toast; the role guard then redirects to the role's home.
**Status:** Tested (web build: empty-form validation, wrong password, success → `/home`, `/patients`, `/admin`, `/doctor` per role)
**Notes:** SecureStore persistence itself is native-only → untested on device.

**Feature:** Registration (2 steps: details → role)
**Existing Web Location:** `pages/auth/RegisterPage.jsx`
**Mobile Location:** `src/app/register.tsx`
**API:** `POST /api/auth/register`
**Dependencies:** —
**Implementation:** same rules (names, email, password ≥ 6 chars with a digit, confirmation); roles patient / caregiver / doctor; server `errors[]` mapped back to fields.
**Status:** Tested (web build: validation messages, successful patient registration)

**Feature:** Session restore, expiry and logout
**Existing Web Location:** `context/AuthContext.jsx`, `api/axios.js`
**Mobile Location:** `src/context/AuthContext.tsx`, `src/api/client.ts`
**API:** `GET /api/auth/me`
**Dependencies:** expo-secure-store
**Implementation:** token + user restored on launch and re-validated; 401 on any authenticated call → sign-out with message; offline → cached session kept; logout clears storage and query cache.
**Status:** Tested (web build: reload keeps session; corrupted token → `/login` with storage cleared; logout)

**Feature:** Role-based access (`ProtectedRoute`)
**Existing Web Location:** `routes/ProtectedRoute.jsx`, `routes/AppRoutes.jsx`
**Mobile Location:** `src/app/_layout.tsx`, `src/app/index.tsx`
**API:** backend `authorize()` middleware
**Implementation:** `Stack.Protected` guards per auth state and role.
**Status:** Tested (web build: signed-out → `/login`; patient opening `/patients` → `/home`)

**Feature:** Password change & account recovery email
**Existing Web Location:** `pages/SettingsPage.jsx`
**Mobile Location:** `src/app/settings.tsx`
**API:** none — the web page only waits on `setTimeout` and shows a success toast
**Status:** Blocked
**Notes:** Needs backend endpoints (e.g. `PUT /api/user/password`). The mobile Settings screen says it is unavailable instead of faking success.

**Feature:** Password reset, OTP, social login, email verification
**Status:** Not Applicable (not present in the web app or backend; `passwordResetToken` fields exist in the schema but are unused)

---

## Patient

**Feature:** Dashboard
**Existing Web Location:** `pages/dashboards/PatientDashboard.jsx`
**Mobile Location:** `src/app/(patient)/(tabs)/home.tsx`
**API:** `GET /medication`, `/medication/stats`, `/vitals`, `/vitals/today-check`
**Dependencies:** react-native-svg (progress rings)
**Implementation:** greeting, adherence rings, stat tiles, medications for a date (day navigator replaces `<input type=date>`), latest vitals, quick links.
**Status:** Tested (web build)
**Notes:** "Missed %" is shown as 0 when nothing is logged (web shows 100 % missed on an empty day).

**Feature:** Daily vitals prompt
**Existing Web Location:** `components/ui/DailyVitalsModal.jsx`
**Mobile Location:** `src/components/VitalsFormSheet.tsx` (daily variant)
**API:** `GET /vitals/today-check`, `POST /vitals`
**Status:** Tested (web build: prompt appears, saves, dashboard updates)

**Feature:** Medications — schedule, drug information, history
**Existing Web Location:** `pages/dashboards/MedicationsPage.jsx`
**Mobile Location:** `src/app/(patient)/(tabs)/medications.tsx`, `src/components/MedicationFormSheet.tsx`
**API:** `GET/POST /medication`, `PUT/DELETE /medication/:id`, `POST /medication/:id/log`, `GET /medication/history`
**Implementation:** segmented tabs; per-day schedule by time of day with Take / Skip; add/edit in a bottom sheet; delete with confirmation; history list.
**Status:** Tested (web build: validation, add, Take, drug-info list, history)
**Notes:** If no medical profile exists the backend refuses to add; the app explains and opens Medical Profile.

**Feature:** Smart reminders ("Today")
**Existing Web Location:** `pages/SmartRemindersPage.jsx`
**Mobile Location:** `src/app/(patient)/(tabs)/today.tsx`
**API:** `POST /smart-reminders/generate`, `GET /smart-reminders/upcoming`, `POST /smart-reminders/acknowledge/:id`
**Dependencies:** expo-speech
**Implementation:** large I TOOK IT / LATER / SKIP buttons, spoken confirmation when voice prompts are on.
**Status:** Tested (web build: LATER acknowledged, list updated); speech untested on device

**Feature:** Health vitals
**Existing Web Location:** `pages/dashboards/VitalsPage.jsx`
**Mobile Location:** `src/app/(patient)/(tabs)/vitals.tsx`
**API:** `GET /vitals/history`, `POST /vitals`, `DELETE /vitals/:id`
**Implementation:** the web table becomes cards; add sheet; delete with confirmation.
**Status:** Tested (web build: list, add); delete tested via API contract test

**Feature:** Medical profile
**Existing Web Location:** `pages/dashboards/PatientProfilePage.jsx`
**Mobile Location:** `src/app/(patient)/medical-profile.tsx`
**API:** `GET/PUT /patient/profile`
**Dependencies:** @react-native-community/datetimepicker
**Implementation:** first-time setup opens in edit mode (404); comma lists → arrays.
**Status:** Tested (web build: first-time setup, required DOB, save, round-trip); native date picker untested on device

**Feature:** Care team
**Existing Web Location:** `pages/dashboards/CareTeamPage.jsx`
**Mobile Location:** `src/app/(patient)/care-team.tsx`
**API:** `/caregiver/my-team`, `/caregiver/available`, `/caregiver/patient-requests`, `POST /caregiver/request`
**Status:** Tested (web build: send request → pending)

**Feature:** Caregiver reminders inbox
**Existing Web Location:** `pages/dashboards/RemindersPage.jsx`
**Mobile Location:** `src/app/(patient)/reminders.tsx`
**API:** `GET /reminders`, `PATCH /reminders/:id/read`
**Status:** Tested (web build: list; mark-read tested via API)

**Feature:** Adherence analytics
**Existing Web Location:** `pages/AdherenceDashboardPage.jsx`, `components/ui/AdherenceChart.jsx`
**Mobile Location:** `src/app/(patient)/adherence.tsx`, `src/components/ui/Charts.tsx`
**API:** `GET /adherence/today`, `GET /adherence/weekly`
**Status:** Tested (web build)

**Feature:** Compliance logs (filters + pagination)
**Existing Web Location:** `pages/AdherenceHistoryPage.jsx`
**Mobile Location:** `src/app/(patient)/adherence-history.tsx`
**API:** `GET /adherence/history`
**Implementation:** filter sheet (medication, status, date range); infinite scroll replaces page buttons.
**Status:** Tested (web build: list); status filter tested via API

**Feature:** Mood check
**Existing Web Location:** `pages/PatientMoodPage.jsx`, `components/ui/MoodSelector.jsx`
**Mobile Location:** `src/app/(patient)/mood.tsx`
**API:** `POST /caregiver-dashboard/mood`, `GET /caregiver-dashboard/mood/:patientId`
**Status:** Tested (web build)

---

## Shared (patient & caregiver)

**Feature:** Emergency contacts
**Existing Web Location:** `pages/EmergencyContactsPage.jsx`
**Mobile Location:** `src/app/emergency-contacts.tsx`
**API:** `/caregiver-dashboard/emergency-contacts` (POST, GET/:patientId, PUT/:id, DELETE/:id)
**Implementation:** list with Call now (`tel:`) and email (`mailto:`); add/edit sheet; primary + alerts toggles; caregiver picks the patient.
**Status:** Tested (web build: add with primary flag, caregiver view); edit/delete tested via API; dialer untested on device

**Feature:** Reports & risk hub
**Existing Web Location:** `pages/ReportsPage.jsx`
**Mobile Location:** `src/app/reports.tsx`
**API:** `GET /reports/adherence`, `/reports/medications`, `/reports/risk-analysis`, `/adherence/weekly`
**Status:** Tested (web build, patient and caregiver)
**Notes:** the web "Compliance Trend Visualizer" uses hard-coded bar heights, and its risk badge always shows "Low" (wrong prop). Mobile shows the real 7-day data and real risk level.

**Feature:** Export — CSV and printable report
**Existing Web Location:** `components/ui/ExportButton.jsx`
**Mobile Location:** `src/components/ExportActions.tsx`
**API:** `GET /adherence/export?format=csv`, `GET /reports/export/pdf`
**Dependencies:** expo-file-system, expo-sharing, expo-print
**Implementation:** CSV written to the cache and shared via the OS share sheet (web: file download). "PDF report" renders the backend's PDF-ready data to a PDF and shares it (web: `window.print()` of the page).
**Status:** CSV Tested (web build: correct file for the selected patient). PDF & share sheet: Implemented — untested on device.

**Feature:** Notifications (bell badge, inbox, filters, read, delete)
**Existing Web Location:** `context/NotificationContext.jsx`, `components/ui/NotificationCenter.jsx`, `pages/NotificationCenterPage.jsx`
**Mobile Location:** `src/components/HeaderActions.tsx`, `src/app/notifications.tsx`
**API:** `GET /notifications/history`, `GET /notifications/unread-count`, `PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`
**Status:** Tested (web build: badge, list, type filter)
**Notes:** the web inbox sends filters to `GET /notifications`, which ignores them; mobile uses the existing `/notifications/history`, which applies them.

**Feature:** Real-time events, toasts and voice alerts
**Existing Web Location:** `context/SocketContext.jsx`, `context/NotificationContext.jsx`
**Mobile Location:** `src/context/SocketContext.tsx`, `src/context/ToastContext.tsx`
**API:** Socket.io (`join` + role events)
**Dependencies:** socket.io-client, expo-speech
**Implementation:** same events; each one also refreshes the affected data; reconnects on app resume.
**Status:** Tested (web build: caregiver received a missed-dose alert card, toast and badge update live; patient events verified in the API test). Background/foreground reconnect untested on device.

**Feature:** My profile
**Existing Web Location:** `pages/ProfilePage.jsx`
**Mobile Location:** `src/app/profile.tsx`
**API:** `PUT /user/profile`
**Status:** Tested (web build)
**Notes:** the web sends `gender: ""` for "Prefer not to say", which the backend rejects (400); mobile sends `prefer_not_to_say`.

**Feature:** Accessibility (high contrast, text size, voice prompts)
**Existing Web Location:** `context/AccessibilityContext.jsx`, `components/ui/AccessibilityToggle.jsx`
**Mobile Location:** `src/context/AccessibilityContext.tsx`, `src/components/AccessibilityControls.tsx`, `src/theme`
**Dependencies:** expo-speech, AsyncStorage
**Status:** Tested (web build: contrast palette, font 15→18 px, persistence); speech untested on device

---

## Caregiver

**Feature:** Overview — patients, poke, remove, connection requests, live missed-dose alerts
**Existing Web Location:** `pages/dashboards/CaregiverDashboard.jsx`
**Mobile Location:** `src/app/(caregiver)/(tabs)/patients.tsx`
**API:** `GET /caregiver/patients`, `GET /caregiver/requests`, `POST /caregiver/requests/:id/handle`, `POST /reminders/poke`, `DELETE /caregiver/patients/:id`
**Status:** Tested (web build: accept request, live alert); poke/remove tested via API

**Feature:** Patient records — vitals, medications CRUD, log dose
**Existing Web Location:** `pages/dashboards/CaregiverDashboard.jsx` (expanded patient panel + med modal)
**Mobile Location:** `src/app/(caregiver)/patient/[id].tsx`
**API:** `GET /caregiver/patients/:id/records`, `GET/POST/PUT/DELETE /caregiver/patients/:id/medications[/:medId]`, `POST .../log`
**Status:** Tested (web build: medications listed, dose logged)
**Notes:** the web reads medications from `/records`, whose query never matches, so its list is always empty. Mobile uses the existing `/caregiver/patients/:id/medications`.

**Feature:** Patient monitoring — risk, today's schedule, timeline, behavioural observation, add contact
**Existing Web Location:** `pages/CaregiverMonitoringPage.jsx`, `components/ui/TimelineView.jsx`
**Mobile Location:** `src/app/(caregiver)/(tabs)/monitoring.tsx`, `src/components/TimelineList.tsx`
**API:** `/caregiver-dashboard/overview`, `/patients/:id/timeline`, `/patients/:id/adherence`, `POST /adherence/confirm`, `POST /caregiver-dashboard/behavioral-observation`, emergency contacts
**Status:** Tested (web build: Administered, observation logged, timeline updated)

**Feature:** Caregiver notes
**Existing Web Location:** `pages/CaregiverNotesPage.jsx`
**Mobile Location:** `src/app/(caregiver)/(tabs)/notes.tsx`
**API:** `/caregiver-dashboard/notes` (POST, GET, PUT, DELETE)
**Status:** Tested (web build: create, edit, delete)

**Feature:** Alerts hub
**Existing Web Location:** `pages/CaregiverAlertsPage.jsx`
**Mobile Location:** `src/app/(caregiver)/(tabs)/alerts.tsx`
**API:** `GET /caregiver-dashboard/alerts`, `PATCH /notifications/:id/read`
**Status:** Tested (web build: alert shown, dismissed)

**Feature:** Cognitive assessments
**Existing Web Location:** `pages/CognitiveAssessmentPage.jsx`
**Mobile Location:** `src/app/(caregiver)/cognitive.tsx`
**API:** `POST /caregiver-dashboard/cognitive-assessment`, `GET /caregiver-dashboard/cognitive-assessments/:patientId`
**Implementation:** steppers replace range sliders (easier to hit; adjustable for screen readers).
**Status:** Tested (web build)

**Feature:** Caregiver reports & risk
**Existing Web Location:** `pages/CaregiverReportsPage.jsx`
**Mobile Location:** `src/app/(caregiver)/caregiver-reports.tsx`
**API:** `/reports/adherence`, `/reports/risk-analysis`, `/caregiver-dashboard/patients/:id/adherence`
**Status:** Tested (web build)

---

## Doctor & admin

**Feature:** Doctor dashboard
**Existing Web Location:** `pages/dashboards/DoctorDashboard.jsx`
**Mobile Location:** `src/app/doctor.tsx`
**API:** none — the web page shows hard-coded stats and four invented patients
**Status:** Blocked
**Notes:** the backend has no endpoint listing a doctor's patients (`User.assignedDoctor` is never set or read), and the timeline/notes endpoints reject doctors who are not assigned caregivers. The mobile screen says so and offers notifications/profile/settings. Needs a backend "doctor ↔ patient" link and a list endpoint.

**Feature:** Admin — user list, counts, search, edit, delete
**Existing Web Location:** `pages/dashboards/AdminDashboard.jsx`
**Mobile Location:** `src/app/admin.tsx`
**API:** `GET /user/all`, `PUT /user/:id`, `DELETE /user/:id`
**Status:** Tested (web build: counts, search, edit, delete). The delete button is disabled on your own account — not exercised.

---

## Not applicable (absent from the web app)

| Area | Finding |
|---|---|
| Maps / location / geolocation | no map code, provider or key |
| File / image upload, camera, gallery | none (`User.avatar` exists but nothing uploads) |
| Multiple languages / RTL | English only, no i18n |
| Light/dark theme switch | web is dark-only; high contrast is reproduced |
| Offline data entry | web has none; mobile shows cached data and pauses queries while offline |
| SEO | web-only concern |
| OS push notifications | the backend has no push-token endpoint (see Remaining work) |

---

## Web-app issues found during analysis

Documented here for the team. The mobile app works around them without backend changes.

1. Caregiver medication list always empty: `getPatientRecords` queries `Medication` by the user id against a field holding the Patient id.
2. Notification filters do nothing: `/notifications` ignores `type`/`priority`.
3. Unread badge resets to 0 after loading notifications (`res.data.unreadCount` does not exist on that endpoint).
4. Profile save fails for "Prefer not to say" (`gender: ""` fails enum validation).
5. `ReportsPage` trend chart is hard-coded; its risk badge ignores the real risk.
6. `SettingsPage` password/recovery forms are simulated.
7. `DoctorDashboard` is entirely placeholder data.
8. Several sidebar links point to routes that do not exist (`/schedule`, `/progress`).
9. Calendar dates (`YYYY-MM-DD`) are stored as UTC midnight and displayed in local time, so users west of UTC see the previous day. Mobile reads date-only fields by their calendar date.

---

## Remaining work

1. **Run on real devices** — Expo Go on Android and iOS, using the checklist below.
2. **Backend work required** (outside mobile scope, not done):
   - password change / reset endpoints (Settings)
   - doctor ↔ patient assignment + list endpoint (Doctor dashboard)
   - push-token registration + sending (true OS push notifications while the app is closed)
3. Production: deploy the backend behind HTTPS and set `EXPO_PUBLIC_API_URL` for EAS builds.

### Device test checklist

- [ ] Login / logout / relaunch keeps the session (SecureStore)
- [ ] Date pickers (medication start/end, DOB, log filters) on Android dialog and iOS sheet
- [ ] Keyboard does not cover fields in bottom sheets (iOS and Android)
- [ ] "Call now" opens the dialer; email opens the mail app
- [ ] Export CSV and PDF report open the share sheet
- [ ] Voice prompts speak (turn on in More → Accessibility)
- [ ] Caregiver poke → patient toast + speech; patient skip → caregiver alert
- [ ] Background the app 1 min, return → Settings shows Real-time updates: Connected
- [ ] Airplane mode → offline banner and cached data; reconnect → refresh
- [ ] Small phone (≈ 360 dp wide) and large text size — no clipped buttons
