/**
 * REGISTER PAGE — RegisterPage.jsx
 * ====================================
 * Multi-field registration form with role selection.
 * Same split-screen design as LoginPage for consistency.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiPhone, FiActivity, FiShield } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const ROLE_REDIRECT = {
  patient:   '/dashboard/patient',
  caregiver: '/dashboard/caregiver',
  doctor:    '/dashboard/doctor',
  admin:     '/dashboard/admin',
};

// Role options with descriptions shown in the role selector
const ROLES = [
  { value: 'patient',   label: 'Patient',   icon: '🏥', desc: 'Track my medications' },
  { value: 'caregiver', label: 'Caregiver', icon: '🤝', desc: 'Help manage a patient' },
  { value: 'doctor',    label: 'Doctor',    icon: '👨‍⚕️', desc: 'Manage my patients' },
];

const RegisterPage = () => {
  const navigate    = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName:  '',
    email:     '',
    password:  '',
    confirmPassword: '',
    role:      'patient',
    phone:     '',
  });

  const [errors, setErrors]       = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep]           = useState(1); // 2-step form: step 1 = info, step 2 = role

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Validate Step 1 fields
  const validateStep1 = () => {
    const errs = {};
    if (!formData.firstName.trim()) errs.firstName = 'First name is required';
    if (!formData.lastName.trim())  errs.lastName  = 'Last name is required';
    if (!formData.email)            errs.email     = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Enter a valid email';
    if (!formData.password)         errs.password  = 'Password is required';
    else if (formData.password.length < 6) errs.password = 'At least 6 characters';
    else if (!/\d/.test(formData.password)) errs.password = 'Must contain a number';
    if (!formData.confirmPassword)  errs.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword)
                                    errs.confirmPassword = 'Passwords do not match';
    return errs;
  };

  const handleStep1Next = () => {
    const errs = validateStep1();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { confirmPassword, ...submitData } = formData;
      const user = await register(submitData);
      navigate(ROLE_REDIRECT[user.role] || '/');
    } catch (error) {
      const apiErrors = error.response?.data?.errors;
      const apiMessage = error.response?.data?.message;

      if (apiErrors && apiErrors.length > 0) {
        // Map field-level validation errors back to form
        const fieldErrors = {};
        apiErrors.forEach(e => { fieldErrors[e.field] = e.message; });
        setErrors(fieldErrors);
        if (step === 2) setStep(1); // Go back if field errors on step 1
        toast.error('Please fix the errors below.');
      } else {
        // Show exact server message (e.g. "Email already exists")
        toast.error(apiMessage || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* ── Left Branding Panel ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-center p-12
                      bg-gradient-to-br from-teal-900/30 via-slate-900 to-blue-900/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

        <div className="relative z-10 space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center">
              <FiActivity className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">MedTracker</span>
          </div>

          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Join thousands of
              <span className="block gradient-text">healthier lives</span>
            </h1>
            <p className="text-white/50 mt-4 leading-relaxed max-w-sm">
              Create your free account and start tracking medications, health vitals,
              and connecting with your care team today.
            </p>
          </div>

          {/* Role cards preview */}
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(role => (
              <div key={role.value} className="glass-card p-4">
                <div className="text-2xl mb-1">{role.icon}</div>
                <div className="text-white font-medium text-sm">{role.label}</div>
                <div className="text-white/40 text-xs">{role.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Form Panel ─────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md animate-slide-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center">
              <FiActivity className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">MedTracker</span>
          </div>

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-white">Create Account</h2>
            <p className="text-white/40 mt-2">Step {step} of 2 — {step === 1 ? 'Your Information' : 'Choose Your Role'}</p>

            {/* Progress bar */}
            <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* ── STEP 1: Personal Info ──────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="firstName" name="firstName" label="First Name"
                    placeholder="Ahmed" icon={FiUser}
                    value={formData.firstName} onChange={handleChange}
                    error={errors.firstName}
                  />
                  <Input
                    id="lastName" name="lastName" label="Last Name"
                    placeholder="Khan" icon={FiUser}
                    value={formData.lastName} onChange={handleChange}
                    error={errors.lastName}
                  />
                </div>

                <Input
                  id="email" name="email" type="email" label="Email Address"
                  placeholder="you@example.com" icon={FiMail}
                  value={formData.email} onChange={handleChange}
                  error={errors.email}
                />

                <Input
                  id="phone" name="phone" type="tel" label="Phone (Optional)"
                  placeholder="+92 300 1234567" icon={FiPhone}
                  value={formData.phone} onChange={handleChange}
                />

                <Input
                  id="password" name="password" type="password" label="Password"
                  placeholder="Min 6 chars, include a number" icon={FiLock}
                  value={formData.password} onChange={handleChange}
                  error={errors.password}
                />

                <Input
                  id="confirmPassword" name="confirmPassword" type="password" label="Confirm Password"
                  placeholder="Re-enter your password" icon={FiLock}
                  value={formData.confirmPassword} onChange={handleChange}
                  error={errors.confirmPassword}
                />

                <Button type="button" fullWidth onClick={handleStep1Next}>
                  Next: Choose Role →
                </Button>
              </div>
            )}

            {/* ── STEP 2: Role Selection ─────────────────────────── */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-in">
                <p className="text-white/50 text-sm">
                  Choose the role that best describes you. This determines which
                  features you can access.
                </p>

                <div className="space-y-3">
                  {ROLES.map(role => (
                    <label
                      key={role.value}
                      htmlFor={`role-${role.value}`}
                      className={`
                        flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200
                        ${formData.role === role.value
                          ? 'border-blue-500/60 bg-blue-600/10'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        id={`role-${role.value}`}
                        name="role"
                        value={role.value}
                        checked={formData.role === role.value}
                        onChange={handleChange}
                        className="sr-only" // Visually hidden — we style the label instead
                      />
                      <span className="text-3xl">{role.icon}</span>
                      <div className="flex-1">
                        <div className="text-white font-semibold">{role.label}</div>
                        <div className="text-white/40 text-xs mt-0.5">{role.desc}</div>
                      </div>
                      {/* Checkmark */}
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                        ${formData.role === role.value
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-white/20'
                        }
                      `}>
                        {formData.role === role.value && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">
                    ← Back
                  </Button>
                  <Button type="submit" isLoading={isLoading} className="flex-1">
                    {isLoading ? 'Creating...' : 'Create Account 🎉'}
                  </Button>
                </div>
              </div>
            )}
          </form>

          {/* Login link */}
          <p className="text-center text-white/40 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
