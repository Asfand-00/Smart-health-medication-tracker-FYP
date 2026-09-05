/**
 * PROTECTED ROUTE — ProtectedRoute.jsx
 * ========================================
 * A wrapper component that guards private routes.
 *
 * HOW IT WORKS:
 * → If user is NOT authenticated → redirect to /login
 * → If user doesn't have the required role → redirect to their dashboard
 * → If everything is fine → render the page (children)
 *
 * USAGE:
 * <ProtectedRoute>                          ← any logged-in user
 *   <ProfilePage />
 * </ProtectedRoute>
 *
 * <ProtectedRoute allowedRoles={['admin']}> ← admin only
 *   <AdminDashboard />
 * </ProtectedRoute>
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Maps each role to its dashboard route
const ROLE_DASHBOARDS = {
  patient:   '/dashboard/patient',
  caregiver: '/dashboard/caregiver',
  doctor:    '/dashboard/doctor',
  admin:     '/dashboard/admin',
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // While checking localStorage / verifying token, show nothing
  // (prevents flash of login page on refresh)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in → send to login page
  // Save current location so we can redirect back after login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but role not allowed → redirect to their own dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const userDashboard = ROLE_DASHBOARDS[user.role] || '/login';
    return <Navigate to={userDashboard} replace />;
  }

  // All checks passed → render the protected page
  return children;
};

export default ProtectedRoute;
