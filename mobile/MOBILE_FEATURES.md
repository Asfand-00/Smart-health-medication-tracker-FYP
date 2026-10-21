# MedTracker Mobile — Feature Inventory

Every module of the project specification (§1.2 of the FYP document) and how it is
implemented in the mobile app (`mobile/src`) and the backend (`backend/src`).

**Statuses**

- **Tested** — exercised end to end against the real backend + MongoDB (see *How it was tested*).
- **Implemented** — code complete and type-checked, but it behaves differently on a real
  phone (native pickers, push, share sheet) and that part was not exercised on a device.

---

## How it was tested (21 Oct 2026)

| Check | Result |
|---|---|
| `tsc --noEmit` (strict) | passes |
| `expo-doctor` | 21/21 checks pass |
| `expo export --platform all` | web, iOS (Hermes) and Android (Hermes) bundles build |
| Backend API suite — `backend/tests/api.test.js` (`npm test`), every module, role 401/403 rules, encryption, sockets | **55/55 pass** |
| UI — the exported react-native-web build in a 390×844 headless Chrome, signed in as patient, caregiver, doctor and admin, every screen below opened and the main flows driven through the UI (password recovery, condition tracking, plan request → approval, text prescription → extraction → doctor verification → apply, notification settings + test alert, doctor note, admin broadcast, config save) | **63/63 pass, no console or page errors** |

**Not tested on a device:** no Android/iOS device or emulator was available. Camera / document
pickers, OS push notifications, local reminder notifications, share sheet and PDF printing
are implemented with the SDK 57 APIs but still need the device checklist at the end.

---

## 1. Authentication and User Management

| Feature | Mobile | API | Status |
|---|---|---|---|
| Registration (2 steps) and secure login | `app/register.tsx`, `app/login.tsx` | `POST /auth/register`, `POST /auth/login` | Tested |
| Role-based access (patient / caregiver / doctor / admin) | `app/_layout.tsx` route groups `(patient) (caregiver) (doctor) (admin)` with `Stack.Protected` | `authorize()` + `utils/access.js` | Tested |
| Password encryption & session handling | bcrypt on server; JWT carries a token version — password change / reset / "sign out everywhere" revoke older tokens; 5 failed logins lock the account 15 min | `authMiddleware.js`, `auth.service.js` | Tested |
| Profile creation and management | `app/profile.tsx` | `PUT /user/profile` | Tested |
| Account update and recovery | Settings → change password, recovery email, sign out everywhere, account activity; Login → **Forgot your password?** (`app/forgot-password.tsx`: email → 6-digit code → new password) | `PUT /auth/change-password`, `PUT /user/recovery`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/logout`, `GET /audit/me` | Tested |

## 2. Patient Profile Management

| Feature | Mobile | API | Status |
|---|---|---|---|
| Personal information & medical history | `(patient)/medical-profile.tsx` | `GET/PUT /patient/profile` | Tested |
| Health condition tracking (status, severity, diagnosis date, change log) | `components/ConditionsCard.tsx` on the medical profile; doctor sees it on the patient overview | `/patient/conditions`, `/patient/:userId/conditions` | Tested |
| Caregiver assignment and linking | `(patient)/care-team.tsx` — My team / Find caregiver / **Find doctor** | `/caregiver/*`, `/doctor/request · my-doctor · my-requests` | Tested |
| Care-team read access to the profile | doctor overview, admin user screen | `GET /patient/:userId/profile` | Tested |

## 3. Medication Management

| Feature | Mobile | API | Status |
|---|---|---|---|
| Add / edit / delete, dosage & frequency scheduling, history | `(patient)/(tabs)/medications.tsx` | `/medication` | Tested |
| Calendar-based medication view | `app/calendar.tsx` — month grid coloured by outcome, per-day dose list (patient, caregiver, doctor, admin) | `GET /medication/calendar?month=` | Tested |
| Drug information management | `app/drug-info.tsx` — reference search, uses / side effects / warnings, interaction check of the patient's active medicines | `GET /medication/drug-info[/:name]`, `GET /medication/interactions` | Tested |
| Treatment templates (FR12) | `app/templates.tsx` — 6 seeded plans + own templates, one-tap apply | `/medication-templates` | Tested |
| Plan approval (FR8 / FR9) | `screens/PlanRequestsScreen.tsx` (`/plan-requests`, doctor tab *Approvals*) — propose add / change / stop to a caregiver or doctor; reviewer approves (applied automatically) or rejects | `/medication-plans/*` | Tested |
| Doctor-managed medications | `(doctor)/doctor-patient/[id].tsx` | `/doctor/patients/:id/medications` | Tested |

## 4. Intelligent Reminder System

| Feature | Mobile | API | Status |
|---|---|---|---|
| Automated reminders, one-tap confirmation, voice prompts | `(patient)/(tabs)/today.tsx` + expo-speech | `/smart-reminders/*` | Tested |
| Missed-dose alerts & 3-level escalation | socket events + notifications; escalation timing configurable by admin | scheduler every 5 min | Tested (API) |
| Adaptive reminder timing | `components/ReminderPreferencesCard.tsx` on Today — per-slot times, lead minutes, server suggestions with one-tap apply; AI recommendations also apply suggestions | `GET/PUT /smart-reminders/preferences`, `POST /smart-reminders/suggestions/apply` | Tested |
| Multi-channel (app / email / push / SMS) | see module 9 | — | Tested |
| Local device reminders while the app is closed | `hooks/usePushNotifications.ts` schedules today's pending doses as local notifications (works in Expo Go) | — | Implemented (device) |

## 5. Medication Adherence Monitoring

| Feature | Mobile | API | Status |
|---|---|---|---|
| Dose confirmation, daily/weekly reports, logs, real-time monitoring | `(patient)/adherence.tsx`, `adherence-history.tsx`, caregiver *Monitoring* | `/adherence/*` | Tested |
| Caregiver and doctor visibility | caregiver screens; doctor patient overview; linked doctors now pass the access checks (previously doctors were rejected by the dashboard endpoints) | `utils/access.js` | Tested |

## 6. Caregiver Dashboard

| Feature | Mobile | API | Status |
|---|---|---|---|
| Real-time patient monitoring, adherence alerts, status overview, notes, remote supervision | `(caregiver)/(tabs)/*`, `patient/[id]`, `cognitive`, `caregiver-reports` | `/caregiver-dashboard/*`, `/caregiver/*` | Tested |
| Bug fix | caregiver *records* now returns the medication list (query used the wrong id field) | `caregiver.controller.js` | Tested |

## 7. Health Analytics and Reporting

| Feature | Mobile | API | Status |
|---|---|---|---|
| Adherence charts | `adherence.tsx`, `reports.tsx` | `/adherence/weekly` | Tested |
| Health trend visualisation | `app/analytics.tsx` — line charts with normal-range bands for BP, heart rate, sugar, SpO₂, weight, temperature; mood and cognitive trends; 14/30/90-day window | `GET /reports/health-trends` | Tested |
| Data-driven insights | insights list (out-of-range vitals, rising/falling trends, adherence change, cross-signals) | `GET /reports/insights` | Tested |
| Performance over time | monthly bars, best/worst week, month-over-month change | `GET /reports/performance` | Tested |
| Downloadable reports (PDF/CSV) | `components/ExportActions.tsx` (PDF via expo-print, adherence CSV) + vitals / medications / mood / full CSV | `/reports/export/pdf`, `/reports/export/csv`, `/adherence/export` | Tested (web download); share sheet Implemented |

## 8. AI-Based Prediction and Alerts

| Feature | Mobile | API | Status |
|---|---|---|---|
| Missed-dose prediction | `app/ai-insights.tsx` — probability per medication × dose slot (recency-weighted miss rate, weekday factor, streaks, trend) | `GET /ai/insights` | Tested |
| Behavioural pattern analysis | misses by time of day / weekday, streaks, consistency, response time, weekend effect, mood correlation | same | Tested |
| Risk detection for irregular habits | consecutive misses, declining trend, chronic slot, slow response, cognitive decline, behavioural concerns, polypharmacy, drug interactions | same | Tested |
| Preventive health alerts | hourly job raises `AiAlert`s, notifies patient (and care circle above the caregiver threshold), outcome tracking & accuracy; "Run check now" button | `POST /ai/run`, `GET /ai/alerts · accuracy` | Tested |
| Personalised recommendations | actionable cards (move reminder time — one tap, enable channels, caregiver supervision, doctor review…) | same | Tested |

## 9. Notification System

| Feature | Mobile | API | Status |
|---|---|---|---|
| Push notifications | `hooks/usePushNotifications.ts` registers the Expo push token (needs a development build; Expo Go on Android cannot receive remote push) and schedules local reminders; taps open the right screen | `POST/DELETE /notifications/push-token`, `utils/push.js` | Implemented (device) |
| Email alerts for missed doses | Nodemailer, mock logging without SMTP | `notification.service.js` | Tested (mock) |
| SMS support | Twilio REST for high/critical alerts when the user opts in; mock without credentials | `utils/sms.js` | Tested (mock) |
| Alert customisation | `app/notification-settings.tsx` — channels, 15 alert types, quiet hours, SMS number, voice, registered devices, "send me a test alert" | `GET/PUT /notifications/settings` | Tested |
| Notification history logs | `app/notifications.tsx` — type / priority / read filters, per-channel **delivery log** on each alert | `GET /notifications/history` | Tested |

## 10. Prescription Management

| Feature | Mobile | API | Status |
|---|---|---|---|
| Upload doctor prescriptions | `app/prescription-upload.tsx` — camera / gallery (expo-image-picker) or PDF (expo-document-picker), typed text, details | `POST /prescriptions` (multipart) | Tested (web file input path); native pickers Implemented |
| Text prescription → medication plan (FR11) | "Extract medications" preview, editable list; re-extract on the detail screen | `POST /prescriptions/parse-text`, `POST /prescriptions/:id/parse` | Tested |
| Store / update / verify prescriptions | `app/prescription/[id].tsx` — doctor Verify / Reject with note; patient edits reset verification; apply to schedule once verified | `PUT …/:id`, `POST …/:id/verify`, `POST …/:id/apply` | Tested |
| Prescription history | change history on the detail screen; archive / restore | `GET …/:id/history`, `DELETE …/:id` | Tested |
| Secure document handling | files encrypted at rest (AES-256-GCM), streamed decrypted only to the patient's care team, every view audited | `GET …/:id/file` | Tested |
| Lists | `screens/PrescriptionsScreen.tsx` (`/prescriptions`, doctor tab) with status filters | `GET /prescriptions` | Tested |

## 11. Security and Data Protection

| Feature | Where | Status |
|---|---|---|
| Secure health data storage | bcrypt passwords, encrypted uploads, token versioning, soft-delete anonymisation | Tested |
| Encrypted communication | HTTPS termination is a deployment concern (`trust proxy`, Helmet HSTS); API never returns secrets | Tested (headers) |
| Role-based authorization | `utils/access.js` — patient self, caregiver assigned, doctor linked, admin all; unlinked doctors get 403 everywhere | Tested |
| Access logs and audit trails | every mutating request + auth/security events in `AuditLog`; user view `app/activity.tsx`; admin view `(admin)/audit.tsx` with filters and stats | Tested |
| Privacy and compliance | privacy consent timestamp, data export (`/user/export`), account deletion with password, rate limiting, lockout, maintenance mode, registration switch | Tested |

## 12. Admin Panel

| Feature | Mobile | API | Status |
|---|---|---|---|
| User and role management | `(admin)/(tabs)/users.tsx`, `(admin)/user/[id].tsx` — search/filter, create any role, activate/deactivate (signs out), change role, reset password (code or temporary), unlock, delete | `/admin/users*`, `/user/:id` | Tested |
| System monitoring and control | `(admin)/(tabs)/monitor.tsx` — server/database health, memory, sockets, scheduler state, counters, run background jobs | `/admin/dashboard · health-checks · jobs/:name` | Tested |
| Notification and alert management | `(admin)/(tabs)/admin-alerts.tsx` — broadcast to roles, platform notification log with delivery status, critical/escalation/AI alerts, high-risk patients | `/admin/notifications*`, `/admin/alerts` | Tested |
| Administrative reporting | `(admin)/(tabs)/admin-reports.tsx` — adherence by month, user growth, notification volume, risk distribution, prescriptions, top medicines; users/adherence/audit CSV | `/admin/reports/*` | Tested |
| Platform configuration | `(admin)/(tabs)/config.tsx` — maintenance mode, registration, default reminder times, escalation, AI thresholds, channels, security policy, prescription rules | `GET/PUT /admin/config` | Tested |

## Doctor portal (spec §1.5 "Doctor")

`(doctor)/(tabs)`: Dashboard (stats, patient requests, high-risk list), Patients (adherence +
risk), Prescriptions (verify), Approvals, More; `(doctor)/doctor-patient/[id]` overview with
medications, schedule, prescriptions, conditions, vitals, clinical notes. Tested.

---

## Device test checklist

- [ ] Login / logout / relaunch keeps the session (SecureStore)
- [ ] Notification permission prompt; local reminders fire at the configured times (Expo Go)
- [ ] Development build: push token appears under Settings → Notifications → devices; test alert arrives on the lock screen
- [ ] Prescription upload from camera and gallery; PDF from the document picker; the detail screen shows the decrypted image
- [ ] Date pickers (medication, DOB, prescription issued date, condition diagnosed date) on Android dialog and iOS sheet
- [ ] Export CSV / PDF / data export open the share sheet
- [ ] Voice prompts speak (More → Accessibility)
- [ ] Caregiver poke → patient toast + speech; patient skip → caregiver alert
- [ ] Background the app 1 min, return → Settings shows Real-time updates: Connected
- [ ] Airplane mode → offline banner and cached data; reconnect → refresh
- [ ] Small phone (≈ 360 dp) and large text size — calendar grid, charts and tab bars not clipped
