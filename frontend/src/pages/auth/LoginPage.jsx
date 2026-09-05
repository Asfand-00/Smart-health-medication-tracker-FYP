/**
 * LOGIN PAGE — LoginPage.jsx
 * ============================
 * Full-screen login page with glassmorphism design.
 * Handles form state, validation, API call, and role-based redirect.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock, FiActivity } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

// Maps each role to its dashboard path
const ROLE_REDIRECT = {
  patient: '/dashboard/patient',
  caregiver: '/dashboard/caregiver',
  doctor: '/dashboard/doctor',
  admin: '/dashboard/admin',
};

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Form state
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Handle input changes — update the correct field by name
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field as user types
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Client-side validation before calling API
  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default browser form submission

    // Validate first
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Call AuthContext login → makes API call → stores token
      const user = await login(formData.email, formData.password);

      // Redirect to the page they were trying to visit, or their role dashboard
      const from = location.state?.from?.pathname || ROLE_REDIRECT[user.role] || '/';
      navigate(from, { replace: true });

    } catch (error) {
      // Extract error message from API response
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error(message);

      // Show field-level error for credential issues
      if (error.response?.status === 401) {
        setErrors({ password: 'Invalid email or password' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* ── Left Panel: Branding (hidden on mobile) ─────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12
                      bg-gradient-to-br from-blue-900/40 via-slate-900 to-teal-900/30">

        {/* Decorative blobs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center shadow-lg">
            <FiActivity className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">MedTracker</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-5xl font-bold text-white leading-tight">
              Smart Medication
              <span className="block gradient-text">Health Tracker</span>
            </h1>
            <p className="text-white/50 text-lg leading-relaxed max-w-md">
              Manage medications, track health vitals, and stay connected
              with your care team — all in one place.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {['Medication Reminders', 'Health Analytics', 'Doctor Connect', 'Caregiver Access'].map(f => (
              <span key={f}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-white/60 text-xs font-medium">
                ✦ {f}
              </span>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { value: '10K+', label: 'Patients' },
            { value: '500+', label: 'Doctors' },
            { value: '99.9%', label: 'Uptime' },
          ].map(stat => (
            <div key={stat.label} className="glass-card p-4 text-center">
              <div className="text-2xl font-bold gradient-text">{stat.value}</div>
              <div className="text-white/40 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel: Login Form ──────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-slide-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <FiActivity className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">MedTracker</span>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white">Welcome back</h2>
            <p className="text-white/40 mt-2">Sign in to your account to continue</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            <Input
              id="email"
              name="email"
              type="email"
              label="Email Address"
              placeholder="you@example.com"
              icon={FiMail}
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              autoComplete="email"
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="Enter your password"
              icon={FiLock}
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              autoComplete="current-password"
            />



            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Register link */}
          <p className="text-center text-white/40 text-sm">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
