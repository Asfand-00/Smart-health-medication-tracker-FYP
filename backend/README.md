# Smart Medication Health Tracker — Backend API

Node.js + Express + MongoDB (Mongoose) + Socket.io. This is the single backend for the
mobile app (`../mobile`). Every module of the project specification is implemented here.

## Run

```bash
cp .env.example .env     # set MONGO_URI, JWT_SECRET (and optionally SMTP / Twilio / FILE_ENCRYPTION_KEY)
npm install
npm run dev              # http://localhost:5000/api/health
npm run seed:admin       # creates the admin account ali@gmail.com / ali123
npm test                 # end-to-end API suite against the running server (55 checks)
```

Email, SMS and OS push fall back to console "mock" delivery when their credentials are not
configured, and the delivery log of every notification records that, so the whole pipeline
can be exercised without external accounts.

## Modules → endpoints

| Module (spec §1.2) | Routes |
|---|---|
| Authentication & User Management | `POST /api/auth/register · login · forgot-password · reset-password · logout`, `PUT /api/auth/change-password`, `GET /api/auth/me`, `PUT /api/user/profile`, `PUT /api/user/recovery`, `GET /api/user/export`, `DELETE /api/user/me`, `POST /api/user/consent` |
| Patient Profile Management | `GET/PUT /api/patient/profile`, `GET /api/patient/:userId/profile` (care team), `GET/POST /api/patient[/:userId]/conditions`, `PUT/DELETE …/conditions/:id`, caregiver linking under `/api/caregiver/*`, doctor linking under `/api/doctor/*` |
| Medication Management | `CRUD /api/medication`, `POST /api/medication/:id/log`, `GET /api/medication/history · stats`, `GET /api/medication/calendar?month=`, `GET /api/medication/drug-info[/:name]`, `GET /api/medication/interactions`, templates `/api/medication-templates` (FR12), plan approvals `/api/medication-plans` (FR8/FR9) |
| Intelligent Reminder System | `/api/smart-reminders/generate · upcoming · acknowledge/:id · history · suggestions · missed`, `GET/PUT /api/smart-reminders/preferences` (adaptive timing), `POST /api/smart-reminders/suggestions/apply`, caregiver reminders & pokes `/api/reminders`, 5-minute scheduler with 3-level escalation |
| Medication Adherence Monitoring | `/api/adherence/confirm · today · daily/:date · weekly · monthly · history · export?format=csv`, `risk-score/:id · predictions/:id · patterns/:id` |
| Caregiver Dashboard | `/api/caregiver-dashboard/overview · alerts · patients/:id/timeline · patients/:id/adherence`, notes, cognitive assessments, behavioural observations, mood, emergency contacts |
| Doctor portal | `/api/doctor/available · request · my-doctor · my-requests` (patient), `/api/doctor/dashboard · requests · patients · patients/:id/overview · patients/:id/medications`, `/api/doctor/notes` |
| Health Analytics & Reporting | `/api/reports/adherence · medications · risk-analysis · export/pdf`, `GET /api/reports/health-trends?days= · insights · performance?months= · export/csv?type=vitals\|medications\|mood\|full` |
| AI-Based Prediction & Alerts | `GET /api/ai/insights` (missed-dose probability per dose slot, behaviour patterns, risk flags, recommendations), `GET /api/ai/alerts · accuracy`, `POST /api/ai/run`; hourly preventive-alert job notifies the patient and care circle |
| Notification System | `/api/notifications` inbox + `history` with filters and per-channel **delivery log**, `GET/PUT /api/notifications/settings` (channels, alert types, quiet hours, SMS number), `POST/DELETE /api/notifications/push-token`, `POST /api/notifications/test`; email (Nodemailer), SMS (Twilio REST), push (Expo), Socket.io real-time |
| Prescription Management | `POST /api/prescriptions` (multipart photo/PDF or JSON/text), `GET /api/prescriptions[/:id]`, `GET …/:id/file` (decrypted stream), `PUT …/:id`, `POST …/:id/verify` (doctor), `POST …/:id/parse` and `POST /api/prescriptions/parse-text` (FR11 text → medication plan), `POST …/:id/apply`, `GET …/:id/history`, `DELETE …/:id` (archive) |
| Security & Data Protection | JWT with token versioning (password change / "sign out everywhere" revokes old tokens), bcrypt, login lockout, rate limiting, Helmet headers, AES-256-GCM encryption of uploaded documents, central role-based access rules (`src/utils/access.js`), audit trail `GET /api/audit[/me|/stats]`, request access log, data export & account deletion, maintenance mode |
| Admin Panel | `/api/admin/dashboard · health-checks · jobs/:name`, `/api/admin/users` (search, create, status, role, reset-password, unlock), `/api/admin/notifications/broadcast`, `/api/admin/notifications`, `/api/admin/alerts`, `/api/admin/reports/overview · export`, `GET/PUT /api/admin/config` |

## Project layout

```
src/
  app.js                 middleware + route registration
  server.js              HTTP + Socket.io + scheduler + seeding
  middleware/            auth (JWT + token version), roles, security (helmet, rate limits, maintenance), errors
  utils/                 access rules, crypto (AES-GCM, OTP), email, sms, push
  features/<module>/     model · service · controller · routes per module
  data/drugs.json        offline drug reference used by drug-info and interaction checks
tests/api.test.js        end-to-end API suite (npm test)
uploads/prescriptions/   encrypted documents (git-ignored)
```

## Configuration (`.env`)

See `.env.example`. Notable keys: `FILE_ENCRYPTION_KEY` (document encryption), `EMAIL_*`
(SMTP), `TWILIO_*` (SMS), `CLIENT_URLS` (browser origins), `EXPOSE_RESET_CODE` (development:
return the password-reset code in the API response), `DISABLE_RATE_LIMIT` (tests only).
Runtime settings (reminder times, escalation, AI thresholds, security policy, maintenance
mode, registration) live in the database and are edited from the admin app.
