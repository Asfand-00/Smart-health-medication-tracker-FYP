/**
 * DASHBOARD LAYOUT — DashboardLayout.jsx
 * =========================================
 * Shared wrapper for all dashboard pages.
 * Contains: Sidebar + Top Navbar + Main Content Area
 *
 * WHY a shared layout?
 * → All 4 dashboards (patient, doctor, caregiver, admin) share the same
 *   sidebar/navbar structure. Reusing it avoids repeating code.
 * → Each dashboard only defines its unique content area.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FiActivity, FiHome, FiUser, FiLogOut,
  FiMenu, FiX, FiBell, FiSettings
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import NotificationCenter from '../ui/NotificationCenter';

// Role badge colors
const ROLE_COLORS = {
  patient:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  caregiver: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  doctor:    'bg-teal-500/20 text-teal-300 border-teal-500/30',
  admin:     'bg-red-500/20 text-red-300 border-red-500/30',
};

const DashboardLayout = ({ children, navItems, title }) => {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Common nav items at the bottom of sidebar (same for all roles)
  const bottomNavItems = [
    { to: '/profile',  icon: FiUser,     label: 'My Profile' },
    { to: '/settings', icon: FiSettings, label: 'Settings' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center flex-shrink-0">
          <FiActivity className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-sm">MedTracker</div>
          <div className="text-white/30 text-xs">Health Platform</div>
        </div>
      </div>

      {/* User Info Card */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="glass-card p-3 flex items-center gap-3">
          {/* Avatar initials */}
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-teal-500
                          flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <div className="text-white font-medium text-sm truncate">
              {user?.firstName} {user?.lastName}
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[user?.role]}`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <p className="text-white/20 text-xs font-semibold uppercase tracking-widest px-4 mb-3">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon    = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              {typeof Icon === 'string' ? (
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-sm">{Icon}</span>
              ) : (
                <Icon className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{item.label}</span>
              {/* Notification badge example */}
              {item.badge && (
                <span className="ml-auto bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="pt-4 border-t border-white/5 mt-4">
          <p className="text-white/20 text-xs font-semibold uppercase tracking-widest px-4 mb-3">
            Account
          </p>
          {bottomNavItems.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                className={`nav-link ${location.pathname === item.to ? 'active' : ''}`}>
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="nav-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <FiLogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* ── Desktop Sidebar ───────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 bg-slate-900/50 border-r border-white/5">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ────────────────────────────────── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
          {/* Drawer */}
          <aside className="relative w-72 bg-slate-900 border-r border-white/10 flex flex-col z-10 animate-slide-up">
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white p-1">
              <FiX className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Navbar */}
        <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Mobile menu button */}
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-white/60 hover:text-white p-1">
                <FiMenu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">{title}</h1>
                <p className="text-white/30 text-xs hidden sm:block">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Right: notifications + user */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setNotifOpen(true)}
                className="relative w-9 h-9 rounded-xl glass-card flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                <FiBell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-3xs font-black rounded-full min-w-5 h-5 flex items-center justify-center px-1 border-2 border-slate-950 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              <Link to="/profile"
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Notifications Drawer */}
      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
};

export default DashboardLayout;
