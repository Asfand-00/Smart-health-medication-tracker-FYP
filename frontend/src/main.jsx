/**
 * MAIN.JSX — Application Entry Point
 * =====================================
 * This is the first React file that runs.
 * It mounts the React app into the <div id="root"> in index.html.
 *
 * PROVIDERS WRAPPED HERE:
 * → BrowserRouter : enables client-side routing (React Router)
 * → AuthProvider  : makes auth state available everywhere
 * → Toaster       : renders toast notifications anywhere in the app
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import './styles/index.css';  // Load Tailwind + global styles

// ReactDOM.createRoot() — React 18's way to render the app
// document.getElementById('root') finds the <div id="root"> in index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      BrowserRouter: enables URL-based navigation.
      Must wrap everything that uses React Router hooks (useNavigate, etc.)
    */}
    <BrowserRouter>
      {/*
        AuthProvider: makes useAuth() available to all components.
        Must wrap everything that needs auth state.
      */}
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <AccessibilityProvider>
              <App />
            </AccessibilityProvider>
          </NotificationProvider>
        </SocketProvider>

        {/*
          Toaster: renders toast notification UI.
          Placed here so it's above everything else in the DOM.
        */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',   // slate-800
              color: '#f8fafc',         // slate-50
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#3b82f6', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
