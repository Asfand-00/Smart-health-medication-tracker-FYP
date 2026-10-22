import { Redirect } from 'expo-router';

import { useAuth } from '../context/AuthContext';
import type { Role } from '../types/models';

/** Home screen per role (first tab of each role group). */
const HOME_BY_ROLE: Record<Role, '/home' | '/patients' | '/dashboard' | '/monitor'> = {
  patient: '/home',
  caregiver: '/patients',
  doctor: '/dashboard',
  admin: '/monitor',
};

export default function Index() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user) return <Redirect href="/login" />;
  return <Redirect href={HOME_BY_ROLE[user.role] ?? '/login'} />;
}
