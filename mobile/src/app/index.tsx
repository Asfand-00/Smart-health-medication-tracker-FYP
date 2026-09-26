import { Redirect } from 'expo-router';

import { useAuth } from '../context/AuthContext';
import type { Role } from '../types/models';

/** web: ROLE_DASHBOARDS in ProtectedRoute.jsx / ROLE_REDIRECT in LoginPage.jsx */
const HOME_BY_ROLE: Record<Role, '/home' | '/patients' | '/doctor' | '/admin'> = {
  patient: '/home',
  caregiver: '/patients',
  doctor: '/doctor',
  admin: '/admin',
};

export default function Index() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user) return <Redirect href="/login" />;
  return <Redirect href={HOME_BY_ROLE[user.role] ?? '/login'} />;
}
