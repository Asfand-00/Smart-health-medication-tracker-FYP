# Smart Medication Health Tracker

Final-year project (SZABIST, BS CS) — a medication-adherence platform for Alzheimer's
patients, their caregivers and doctors, with an administrative panel.

| Part | Folder | Notes |
|---|---|---|
| Backend API | `backend/` | Node.js · Express · MongoDB · Socket.io. All 12 modules of the specification. `npm run dev`, `npm test`. See `backend/README.md`. |
| Mobile app | `mobile/` | React Native (Expo SDK 57, TypeScript, Expo Router). Patient, caregiver, doctor and admin experiences. See `mobile/MOBILE_SETUP.md` and `mobile/MOBILE_FEATURES.md`. |
| Web (legacy) | `frontend/` | Earlier React web client; not updated for the new modules. |

Quick start:

```bash
cd backend && cp .env.example .env && npm install && npm run dev      # API on :5000
cd ../mobile && npm start                                              # Expo dev server, scan with Expo Go
```
