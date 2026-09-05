/**
 * APP ROUTES — AppRoutes.jsx
 * ============================
 * Defines all routes in the application using React Router v6.
 *
 * ROUTE STRUCTURE:
 * /                    → redirect to /login
 * /login               → Login page (public)
 * /register            → Register page (public)
 * /dashboard/patient   → Patient dashboard (patient only)
 * /dashboard/caregiver → Caregiver dashboard (caregiver only)
 * /dashboard/doctor    → Doctor dashboard (doctor only)
 * /dashboard/admin     → Admin dashboard (admin only)
 * /profile             → Profile page (any logged-in user)
 * *                    → 404 Not Found
 */

import { Routes, Route, Navigate } from 'react-router-dom';

// Public pages
import LoginPage    from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// Dashboard pages (role-specific)
import PatientDashboard   from '../pages/dashboards/PatientDashboard';
import PatientProfilePage from '../pages/dashboards/PatientProfilePage';
import MedicationsPage    from '../pages/dashboards/MedicationsPage';
import VitalsPage         from '../pages/dashboards/VitalsPage';
import CareTeamPage       from '../pages/dashboards/CareTeamPage';
import CaregiverDashboard from '../pages/dashboards/CaregiverDashboard';
import DoctorDashboard    from '../pages/dashboards/DoctorDashboard';
import AdminDashboard     from '../pages/dashboards/AdminDashboard';

// Shared pages
import ProfilePage from '../pages/ProfilePage';
import SettingsPage from '../pages/SettingsPage';
import RemindersPage from '../pages/dashboards/RemindersPage';

// New Modules 4-6 Pages
import SmartRemindersPage from '../pages/SmartRemindersPage';
import AdherenceDashboardPage from '../pages/AdherenceDashboardPage';
import AdherenceHistoryPage from '../pages/AdherenceHistoryPage';
import NotificationCenterPage from '../pages/NotificationCenterPage';
import CaregiverMonitoringPage from '../pages/CaregiverMonitoringPage';
import CaregiverNotesPage from '../pages/CaregiverNotesPage';
import CaregiverAlertsPage from '../pages/CaregiverAlertsPage';
import CaregiverReportsPage from '../pages/CaregiverReportsPage';
import CognitiveAssessmentPage from '../pages/CognitiveAssessmentPage';
import PatientMoodPage from '../pages/PatientMoodPage';
import EmergencyContactsPage from '../pages/EmergencyContactsPage';
import ReportsPage from '../pages/ReportsPage';

// Route guard
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = () => {
  return (
    <Routes>
      {/* ── Public Routes (no login needed) ─────────────────────────── */}
      <Route path="/"         element={<Navigate to="/login" replace />} />
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* ── Protected Routes (login required) ───────────────────────── */}

      {/* Profile — any logged-in user */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Settings — any logged-in user */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Patient Dashboard */}
      <Route
        path="/dashboard/patient"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientDashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Patient Medical Profile */}
      <Route
        path="/dashboard/patient/medical-profile"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Patient Medications */}
      <Route
        path="/medications"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <MedicationsPage />
          </ProtectedRoute>
        }
      />

      {/* Patient Vitals */}
      <Route
        path="/vitals"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <VitalsPage />
          </ProtectedRoute>
        }
      />

      {/* Patient Care Team */}
      <Route
        path="/dashboard/patient/care-team"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <CareTeamPage />
          </ProtectedRoute>
        }
      />

      {/* Patient Reminders */}
      <Route
        path="/reminders"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <RemindersPage />
          </ProtectedRoute>
        }
      />

      {/* Caregiver Dashboard */}
      <Route
        path="/dashboard/caregiver"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <CaregiverDashboard />
          </ProtectedRoute>
        }
      />

      {/* Doctor Dashboard */}
      <Route
        path="/dashboard/doctor"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorDashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin Dashboard */}
      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── New Modules 4-6 Pages ───────────────────────────────────── */}
      
      {/* Smart Reminders — patient only */}
      <Route
        path="/smart-reminders"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <SmartRemindersPage />
          </ProtectedRoute>
        }
      />

      {/* Adherence Dashboard — patient only */}
      <Route
        path="/adherence"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <AdherenceDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Adherence History — patient only */}
      <Route
        path="/adherence/history"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <AdherenceHistoryPage />
          </ProtectedRoute>
        }
      />

      {/* Notification Center — any logged-in user */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationCenterPage />
          </ProtectedRoute>
        }
      />

      {/* Caregiver Monitoring — caregiver only */}
      <Route
        path="/dashboard/caregiver/monitoring"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <CaregiverMonitoringPage />
          </ProtectedRoute>
        }
      />

      {/* Caregiver Notes — caregiver only */}
      <Route
        path="/dashboard/caregiver/notes"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <CaregiverNotesPage />
          </ProtectedRoute>
        }
      />

      {/* Caregiver Alerts — caregiver only */}
      <Route
        path="/dashboard/caregiver/alerts"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <CaregiverAlertsPage />
          </ProtectedRoute>
        }
      />

      {/* Caregiver Reports — caregiver only */}
      <Route
        path="/dashboard/caregiver/reports"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <CaregiverReportsPage />
          </ProtectedRoute>
        }
      />

      {/* Cognitive Assessment — caregiver only */}
      <Route
        path="/dashboard/caregiver/cognitive"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <CognitiveAssessmentPage />
          </ProtectedRoute>
        }
      />

      {/* Patient Mood — patient only */}
      <Route
        path="/mood"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientMoodPage />
          </ProtectedRoute>
        }
      />

      {/* Emergency Contacts — patient or caregiver */}
      <Route
        path="/emergency-contacts"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver']}>
            <EmergencyContactsPage />
          </ProtectedRoute>
        }
      />

      {/* Reports Page — patient or caregiver */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['patient', 'caregiver']}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      {/* 404 — catch all unknown routes */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-slate-950">
            <div className="text-center">
              <h1 className="text-8xl font-bold gradient-text mb-4">404</h1>
              <p className="text-white/50 mb-6">Page not found</p>
              <a href="/login" className="btn-primary inline-block">Go Home</a>
            </div>
          </div>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
