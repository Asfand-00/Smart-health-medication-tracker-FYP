# MedTracker Mobile — Setup Guide

React Native (Expo SDK 57, TypeScript) version of the Smart Medication Health Tracker.
It talks to the **existing** Express + MongoDB backend in `../backend` — no backend
changes were made or are required.

---

## 1. Requirements

| Tool | Version | Needed for |
|---|---|---|
| Node.js | **20.19.4+** (22 LTS or 24 LTS recommended) | everything |
| npm | ships with Node (10+) | everything |
| Expo Go app | latest from Play Store / App Store (must support SDK 57) | running on a phone — no Android Studio / Xcode needed |
| MongoDB | local or Atlas | the backend |
| Android Studio + Android SDK + JDK 17 | optional | Android emulator or local native builds |
| macOS + Xcode 16+ | optional | iOS simulator or local iOS builds |

You do **not** need a global Expo CLI — `npx expo` is used.

A physical phone must be on the **same Wi-Fi network** as the computer running the
backend (or use tunnel mode, see Troubleshooting).

---

## 2. Project structure

```text
mobile/
├── src/
│   ├── app/                      # Expo Router — every file is a screen
│   │   ├── _layout.tsx           # providers + auth / role guards (Stack.Protected)
│   │   ├── index.tsx             # redirects to the role's home screen
│   │   ├── login.tsx, register.tsx
│   │   ├── (patient)/            # patient area
│   │   │   ├── (tabs)/           # Home · Today · Medications · Vitals · More
│   │   │   └── medical-profile, care-team, reminders, adherence,
│   │   │       adherence-history, mood
│   │   ├── (caregiver)/          # caregiver area
│   │   │   ├── (tabs)/           # Overview · Monitoring · Alerts · Notes · More
│   │   │   ├── patient/[id].tsx  # patient records & medications
│   │   │   └── cognitive, caregiver-reports
│   │   ├── doctor.tsx, admin.tsx
│   │   └── profile, settings, notifications, emergency-contacts, reports
│   ├── api/                      # axios client, typed endpoint wrappers, query client
│   ├── components/               # shared feature components + ui/ primitives
│   ├── context/                  # Auth, Socket, Accessibility, Toast providers
│   ├── config/env.ts             # backend URL resolution
│   ├── theme/                    # dark + high-contrast palettes, font scale
│   ├── types/models.ts           # API response / request types
│   └── utils/                    # formatting, storage, confirm dialogs
├── scripts/
│   ├── setup.js                  # npm run setup
│   └── start.js                  # npm start
├── assets/                       # app icon, splash, adaptive icons
├── app.json                      # Expo config
├── .env.example
├── MOBILE_SETUP.md               # this file
└── MOBILE_FEATURES.md            # feature-by-feature inventory and status
```

---

## 3. Installation — what `npm start` does

```bash
cd mobile
npm start
```

`npm start` runs `scripts/start.js`, which first runs the setup steps
(`scripts/setup.js`) and then launches Expo:

1. **Toolchain check** — fails with instructions if Node is older than 20.19.4 or npm is missing.
2. **Dependency check** — runs `npm install` **only** when:
   - `node_modules` is missing, or
   - a package listed in `package.json` is missing from `node_modules`, or
   - `package.json` / `package-lock.json` changed since the last successful install
     (a hash is kept in `node_modules/.mobile-setup-stamp`).

   Otherwise nothing is installed, so running `npm start` repeatedly is fast and idempotent.
3. **Environment check** — reads `.env` if present, validates `EXPO_PUBLIC_API_URL` /
   `EXPO_PUBLIC_API_PORT`, and if no URL is set, detects this computer's LAN IPv4
   address (e.g. `http://192.168.1.20:5000`).
4. **Backend check** — calls `GET <backend>/api/health`. If it is not reachable you get a
   warning (not an error) and instructions to start it.
5. **Start** — runs `npx expo start` with the resolved URL injected as
   `EXPO_PUBLIC_API_URL`, and shows the QR code.

The scripts never delete files. To run only the checks: `npm run setup`.

Other scripts:

| Command | What it does |
|---|---|
| `npm run setup` | steps 1–4 only |
| `npm start -- --clear` or `npm run start:clear` | clear the Metro cache |
| `npm run start:tunnel` | Expo tunnel (phone on another network — see Troubleshooting) |
| `npm run android` / `npm run ios` | start and open on a connected device / emulator / simulator |
| `npm run web` | run in a browser (development/testing only) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run doctor` | `expo-doctor` dependency and config checks |

---

## 4. Environment variables

Copy `.env.example` to `.env` only if you need to override the defaults.
`.env` is git-ignored. Only variables prefixed `EXPO_PUBLIC_` reach the app, and they are
**embedded in the JavaScript bundle** — never put secrets in them.

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | empty → LAN IP detected by `npm start` | Backend origin **without** `/api`, e.g. `http://192.168.1.20:5000` or `https://api.example.com`. A trailing `/api` is tolerated. |
| `EXPO_PUBLIC_API_PORT` | `5000` | Port used for automatic detection when `EXPO_PUBLIC_API_URL` is empty. |

Inside the app the URL is resolved in this order (`src/config/env.ts`):
`EXPO_PUBLIC_API_URL` → host of the Expo dev server → `window.location` host (web) →
`10.0.2.2` (Android emulator) / `localhost`.
**Settings → Connection** in the app shows the URL actually in use.

The mobile app needs **no API keys**: the web app uses no maps, analytics or third-party
services, so there are none to configure.

### Backend environment (unchanged)

The backend keeps using `backend/.env` (see `backend/.env.example`):
`PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, and optional
`EMAIL_HOST/PORT/USER/PASS/FROM`. `CLIENT_URL` only affects browsers (CORS); native apps
send no `Origin` header, so it does not need to change for the mobile app.

---

## 5. Running on Android

**Start the backend first** (in another terminal):

```bash
cd backend
npm install
cp .env.example .env    # then set MONGO_URI and JWT_SECRET
npm run dev             # listens on 0.0.0.0:5000
```

Optional admin account: `node scripts/seedAdmin.js` creates `ali@gmail.com` / `ali123`.

### Physical Android phone (recommended)

1. Install **Expo Go** from the Play Store.
2. Connect the phone to the same Wi-Fi as the computer.
3. `cd mobile && npm start`
4. In Expo Go tap **Scan QR code** and scan the QR code in the terminal.
5. Allow Windows Firewall access for Node.js on **private networks** when prompted
   (ports 8081 for Metro and 5000 for the backend must be reachable from the phone).

### Android emulator

1. Install Android Studio → SDK Manager → an Android 14/15 system image; create an AVD in Device Manager.
2. Start the emulator.
3. `npm run android` (or `npm start` then press `a`).
   The LAN IP injected by `npm start` works from the emulator; if you start Expo another way,
   `10.0.2.2` (the emulator's alias for the host machine) is used automatically.

---

## 6. Running on iOS

- **Physical iPhone**: install **Expo Go** from the App Store, join the same Wi-Fi,
  run `npm start`, and scan the QR code with the **Camera** app.
- **iOS simulator** (macOS only): install Xcode, open it once to accept the licence and
  install a simulator runtime, then `npm run ios` (or press `i`).

---

## 7. Running with Expo Go

Every native module this app uses ships inside Expo Go (secure-store, speech, netinfo,
date-time picker, SVG, file-system, sharing, print, async-storage, vector icons), so
**Expo Go is enough for development** — no custom build is required.

Expo Go only supports the SDK it was built for. If Expo Go says the project's SDK is
incompatible, update Expo Go from the store.

---

## 8. Development builds

A development build (your own debug app instead of Expo Go) is only needed if you later add
a native library that is not in Expo Go, want your own app icon/name on the device, or need
to test release-like behaviour.

```bash
npx expo run:android      # needs Android Studio + JDK 17
npx expo run:ios          # needs macOS + Xcode
# or in the cloud, no local SDKs:
npx eas-cli@latest build --profile development --platform android
```

`android/` and `ios/` are generated (Continuous Native Generation) and git-ignored — do not
edit them by hand; change `app.json` instead.

---

## 9. API configuration

- All REST calls go to `<EXPO_PUBLIC_API_URL>/api/...` through one axios instance
  (`src/api/client.ts`) with a 15 s timeout and `Authorization: Bearer <token>`.
- Endpoint wrappers live in `src/api/services.ts`; every path already exists in
  `backend/src/features/**/**.routes.js`. Response types are in `src/types/models.ts`.
- Server state is cached with TanStack Query. Queries pause while offline (NetInfo) and
  refetch when the connection returns or the app comes back to the foreground.
- Real-time updates use Socket.io at the same origin (see **Authentication** below).
- Errors are normalised into `network`, `timeout`, `unauthorized`, `forbidden`,
  `not_found`, `validation` and `server`, and each screen shows a matching error state
  with **Try again**.

---

## 10. Authentication

Same flow and endpoints as the web app:

1. `POST /api/auth/login` or `/api/auth/register` → `{ token, user }` (JWT, 7-day expiry by default).
2. The token and user are stored with **expo-secure-store** (iOS Keychain / Android Keystore),
   not plain storage. (The web build, used only for testing, falls back to AsyncStorage.)
3. On launch the saved session is restored and re-validated with `GET /api/auth/me`.
   An invalid/expired token signs the user out; being offline keeps the cached session.
4. Any `401` on an authenticated request signs the user out ("Your session has expired").
5. Logout clears local state (the backend has no logout endpoint — JWTs are stateless).
6. Role-based access mirrors `ProtectedRoute.jsx`: screens are wrapped in
   `Stack.Protected` guards; a patient cannot open caregiver/admin screens and vice versa.
7. Socket.io: after login the app connects, emits `join` with the user id, and listens for
   the same events as the web app (`new_reminder`, `poke`, `new_notification`,
   `patient_missed_medication`, `patient_dose_update`, `escalation_alert`, `mood_update`,
   `cognitive_alert`, …). It reconnects when the app returns to the foreground.

Not available because the backend has no endpoints for them: password reset, password
change, email verification, social login, OTP.

---

## 11. Maps

**Not applicable.** The web application has no map, location, geolocation or map-provider
code and no map API key, so the mobile app has none either. Nothing to configure.

---

## 12. Permissions

The app requests **no runtime permissions**. The web app has no camera, photo, file-upload,
location, microphone or contacts features, so none are needed.

| Capability | How it works | Permission |
|---|---|---|
| Call an emergency contact | opens the phone dialer with `tel:` | none (user confirms in the dialer) |
| Email a contact | opens the mail app with `mailto:` | none |
| Export CSV / PDF | writes to the app cache and opens the system share sheet | none |
| Voice prompts | text-to-speech via expo-speech | none |
| Secure session storage | Keychain / Keystore | none |

The app does **not** send OS push notifications: the backend has no push-token endpoint.
Alerts arrive in real time while the app is open (toasts + voice) and are always listed under
Notifications. See "Remaining work" in `MOBILE_FEATURES.md`.

---

## 13. Build

- **Development**: `npm start` (Expo Go) or a development build (section 8).
- **Production** (EAS, recommended):

  ```bash
  npm install -g eas-cli        # or use npx eas-cli@latest
  eas login
  eas build:configure           # creates eas.json
  EXPO_PUBLIC_API_URL=https://your-api.example.com eas build --platform android --profile production
  eas build --platform ios --profile production   # needs an Apple Developer account
  ```

  Set `EXPO_PUBLIC_API_URL` in the EAS environment for the build profile so the release
  points at your deployed backend.

- **Production backend must use HTTPS.** Release builds block plain `http://` by default
  (Android cleartext policy, iOS App Transport Security). Expo Go and development builds
  allow the LAN `http://` URL used during development.

- Bundle check without a device: `npx expo export --platform android` (or `ios`).

---

## 14. Troubleshooting

| Problem | Fix |
|---|---|
| **Metro failed / red screen after pulling changes** | `npm run start:clear` |
| **Module not found** | `npm run setup` (reinstalls if packages are missing), then `npm run start:clear`. Add packages with `npx expo install <pkg>`, not `npm install`, so versions match SDK 57. |
| **"Project is incompatible with this version of Expo Go"** | Update Expo Go from the store. |
| **Android SDK missing / `adb` not found** | Only needed for emulators or `expo run:android`. Install Android Studio, then set `ANDROID_HOME` (Windows: `%LOCALAPPDATA%\Android\Sdk`) and add `platform-tools` to `PATH`. With a physical phone + Expo Go you don't need it. |
| **Java version mismatch** | Local Android builds need JDK 17. Point `JAVA_HOME` to it (Android Studio ships one under `jbr`). |
| **"Network request failed" / "Cannot reach the server"** | 1) Backend running? `curl http://<LAN-IP>:5000/api/health` from the computer. 2) Phone on the same Wi-Fi? 3) Windows Firewall: allow Node.js on private networks (or run the terminal as admin: `netsh advfirewall firewall add rule name="MedTracker API" dir=in action=allow protocol=TCP localport=5000`). 4) Check **Settings → Connection** in the app for the URL in use; set `EXPO_PUBLIC_API_URL` in `.env` if it picked the wrong network adapter (VPN / virtual adapters). |
| **API unavailable / MongoDB errors in backend** | Check `MONGO_URI` in `backend/.env`; the backend exits if it cannot connect. |
| **Phone on a different network** | `npm run start:tunnel` exposes Metro only. The phone still needs to reach the backend — deploy it or expose port 5000 (e.g. a tunnel) and set `EXPO_PUBLIC_API_URL` to that URL. |
| **Signed out unexpectedly** | The JWT expired (`JWT_EXPIRES_IN`, default 7 days) or `JWT_SECRET` changed. Sign in again. |
| **"Patient profile not found" when adding a medication** | The backend needs a medical profile first; the app takes you to Medical Profile. |
| **Environment variable missing / wrong** | `npm run setup` prints what it resolved and validates the format. `EXPO_PUBLIC_*` values are read at bundle time — restart with `npm run start:clear` after editing `.env`. |
| **Map not displaying / permission denied** | Not applicable — the app has no map and requests no permissions. |
| **No real-time toasts** | **Settings → Connection → Real-time updates** should say *Connected*. Sockets use the same host/port as the API. |

---

## 15. Architecture

- **Expo SDK 57 / React Native 0.86 / React 19 / TypeScript (strict)**. Expo was chosen
  because every feature maps to Expo SDK modules that ship in Expo Go, so no native tooling
  is needed to develop or test.
- **Navigation — Expo Router** (file-based). Root `Stack` with `Stack.Protected` guards per
  auth state and role; bottom tabs for each role's main areas (replacing the web sidebar);
  stack screens for secondary pages; bottom sheets instead of centred modals.
- **Server state — TanStack Query**: caching, pull-to-refresh, pagination
  (`useInfiniteQuery` for logs and notifications), offline pause (NetInfo) and
  foreground refetch (AppState). Socket events invalidate the affected queries, so any open
  screen refreshes itself.
- **Client state — React context only**: `AuthContext` (session), `SocketContext`
  (connection + live caregiver alerts), `AccessibilityContext` (high contrast, text size,
  voice prompts, persisted in AsyncStorage), `ToastContext`. No Redux/Zustand — the web app
  uses plain context and nothing needs more.
- **HTTP — axios** (as on web) with a request interceptor for the token, a 401 handler and
  error normalisation.
- **UI** — plain `StyleSheet` components in `src/components/ui` (text, buttons, fields,
  select sheet, date picker, chips, steppers, switches, cards, SVG charts, state views). All
  text scales with the accessibility setting and the OS font size; touch targets are ≥ 48 dp.
- **Theme** — dark palette from the web app's Tailwind colours plus its high-contrast mode.
  No light theme (the web app has none). No i18n/RTL (the web app is English-only).

---

## 16. Web vs mobile

| Web feature (page) | Mobile screen | API | Status |
|---|---|---|---|
| Login (`LoginPage`) | `login` | `POST /auth/login` | Tested (web build) |
| Register, 2 steps (`RegisterPage`) | `register` | `POST /auth/register` | Tested (web build) |
| Session restore / expiry (`AuthContext`) | root layout | `GET /auth/me` | Tested (web build) |
| Patient dashboard (`PatientDashboard`) | Home tab | `/medication`, `/medication/stats`, `/vitals`, `/vitals/today-check` | Tested (web build) |
| Daily vitals prompt (`DailyVitalsModal`) | Home → sheet | `POST /vitals` | Tested (web build) |
| Medications: schedule / drug info / history (`MedicationsPage`) | Medications tab | `/medication`, `/medication/:id/log`, `/medication/history` | Tested (web build) |
| Health vitals (`VitalsPage`) | Vitals tab | `/vitals/history`, `POST/DELETE /vitals` | Tested (web build) |
| Smart reminders (`SmartRemindersPage`) | Today tab | `/smart-reminders/generate`, `/upcoming`, `/acknowledge/:id` | Tested (web build) |
| Medical profile (`PatientProfilePage`) | More → Medical profile | `GET/PUT /patient/profile` | Tested (web build) |
| Care team (`CareTeamPage`) | More → Care team | `/caregiver/available`, `/request`, `/my-team`, `/patient-requests` | Tested (web build) |
| Caregiver reminders (`RemindersPage`) | More → Caregiver reminders | `GET /reminders`, `PATCH /reminders/:id/read` | Tested (web build) |
| Adherence analytics (`AdherenceDashboardPage`) | More → My adherence | `/adherence/today`, `/adherence/weekly` | Tested (web build) |
| Compliance logs (`AdherenceHistoryPage`) | More → Compliance logs | `GET /adherence/history` | Tested (web build) |
| Mood check (`PatientMoodPage`) | More → Mood check | `/caregiver-dashboard/mood` | Tested (web build) |
| Emergency contacts (`EmergencyContactsPage`) | More → Emergency support | `/caregiver-dashboard/emergency-contacts` | Tested (web build); dialer on device untested |
| Reports hub (`ReportsPage`) | More → Reports hub | `/reports/adherence`, `/medications`, `/risk-analysis`, `/adherence/weekly` | Tested (web build) |
| CSV export / print (`ExportButton`) | Export CSV / PDF report | `/adherence/export?format=csv`, `/reports/export/pdf` | CSV tested (web build); PDF & share sheet untested on device |
| Notifications (`NotificationCenter`, `NotificationCenterPage`) | bell → Notifications | `/notifications/history`, `/unread-count`, read, read-all, delete | Tested (web build) |
| Real-time toasts & voice (`SocketContext`) | global | Socket.io | Tested (web build, caregiver missed-dose alert) |
| Caregiver dashboard (`CaregiverDashboard`) | Overview tab + Patient records | `/caregiver/patients`, `/requests`, `/reminders/poke`, patient medications CRUD + log | Tested (web build) |
| Patient monitoring (`CaregiverMonitoringPage`) | Monitoring tab | `/caregiver-dashboard/overview`, timeline, adherence, `/adherence/confirm`, behavioural observation | Tested (web build) |
| Caregiver notes (`CaregiverNotesPage`) | Notes tab | `/caregiver-dashboard/notes` CRUD | Tested (web build) |
| Alerts hub (`CaregiverAlertsPage`) | Alerts tab | `/caregiver-dashboard/alerts`, `PATCH /notifications/:id/read` | Tested (web build) |
| Caregiver reports (`CaregiverReportsPage`) | More → Reports & risk | `/reports/*`, patient adherence | Tested (web build) |
| Cognitive assessment (`CognitiveAssessmentPage`) | More → Cognitive status | `/caregiver-dashboard/cognitive-assessment(s)` | Tested (web build) |
| Admin dashboard (`AdminDashboard`) | `admin` | `/user/all`, `PUT/DELETE /user/:id` | Tested (web build) |
| My profile (`ProfilePage`) | header person icon → Profile | `PUT /user/profile` | Tested (web build) |
| Accessibility controls (`AccessibilityToggle`) | More / Settings | local only | Tested (web build); speech untested on device |
| Settings — password & recovery (`SettingsPage`) | Settings | none exist | Blocked — the web version is simulated (setTimeout) |
| Doctor dashboard (`DoctorDashboard`) | `doctor` | none exist | Blocked — the web version shows hard-coded placeholder data |
| Maps / location | — | — | Not applicable (not in the web app) |
| File / image upload | — | — | Not applicable (not in the web app) |

"Tested (web build)" means exercised end to end against the real backend through the
react-native-web build in a 375×812 phone viewport. See `MOBILE_FEATURES.md` → *Testing* for
exactly what was and was not tested, including what still needs a real device.
