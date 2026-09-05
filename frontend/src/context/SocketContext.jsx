/**
 * SOCKET CONTEXT — SocketContext.jsx
 * =====================================
 * Provides real-time Socket.io connection throughout the app.
 * 
 * HOW IT WORKS:
 * 1. When a user logs in, they connect to the Socket server
 * 2. They "join" their personal room using their userId
 * 3. They listen for events like 'new_reminder', 'poke', 'patient_missed_medication'
 * 4. When the event fires, we show a toast notification in real-time
 */

import { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Support both 'id' and '_id' from getPublicProfile()
    const userId = user._id || user.id;
    if (!userId) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    // Join personal room
    socket.emit('join', userId);

    // ── PATIENT EVENTS ────────────────────────────────────────────────
    if (user.role === 'patient') {
      // Listen for new reminders from caregiver
      socket.on('new_reminder', (reminder) => {
        toast(`📋 New Reminder: ${reminder.title}`, {
          icon: '🔔',
          duration: 6000,
          style: { background: '#1e3a5f', color: '#fff', border: '1px solid #3b82f6' },
        });

        // TTS voice guidance for patient
        const synth = window.speechSynthesis;
        if (synth && 'speechSynthesis' in window) {
          const text = reminder.speechText || `Attention. New reminder: ${reminder.title}. ${reminder.message || ''}`;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.85;
          synth.speak(utterance);
        }
      });

      // Listen for poke from caregiver
      socket.on('poke', (data) => {
        toast(`👋 ${data.from} is checking on you!\n${data.message}`, {
          icon: '❗',
          duration: 8000,
          style: { background: '#7c2d12', color: '#fff', border: '1px solid #f97316' },
        });

        // TTS voice guidance for patient
        const synth = window.speechSynthesis;
        if (synth && 'speechSynthesis' in window) {
          const text = `Attention. ${data.from} is checking on you. Message: ${data.message || ''}`;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.85;
          synth.speak(utterance);
        }
      });
    }

    // ── CAREGIVER EVENTS ──────────────────────────────────────────────
    if (user.role === 'caregiver') {
      // Alert when a patient misses medication
      socket.on('patient_missed_medication', (data) => {
        toast(`⚠️ ${data.patientName} missed ${data.medicationName} (${data.timeOfDay})`, {
          icon: '💊',
          duration: 10000,
          style: { background: '#450a0a', color: '#fff', border: '1px solid #ef4444' },
        });
      });

      // Escalation level 3 alert
      socket.on('escalation_alert', (data) => {
        toast(`🚨 Critical: ${data.message}`, {
          icon: '🚨',
          duration: 12000,
          style: { background: '#7f1d1d', color: '#fff', fontWeight: 'bold', border: '1px solid #f87171' }
        });
      });

      // Mood updates
      socket.on('mood_update', (data) => {
        toast(`Mood Alert: ${data.patientName} is feeling ${data.mood}`, {
          icon: '🧠',
          duration: 6000,
          style: { background: '#1e3a8a', color: '#fff', border: '1px solid #60a5fa' }
        });
      });

      // Dose confirmation/skip update from patient
      socket.on('patient_dose_update', (data) => {
        const statusEmoji = data.status === 'taken' ? '✅' : data.status === 'skipped' ? '❌' : '⏱️';
        const statusLabel = data.status === 'taken' ? 'took' : data.status === 'skipped' ? 'skipped' : 'delayed';
        toast(`${statusEmoji} ${data.patientName} ${statusLabel} ${data.medicationName} (${data.timeOfDay})`, {
          icon: '💊',
          duration: 6000,
          style: { 
            background: data.status === 'taken' ? '#064e3b' : data.status === 'skipped' ? '#450a0a' : '#78350f', 
            color: '#fff', 
            border: `1px solid ${data.status === 'taken' ? '#10b981' : data.status === 'skipped' ? '#ef4444' : '#f59e0b'}` 
          },
        });
      });

      // Cognitive alerts
      socket.on('cognitive_alert', (data) => {
        toast(`⚠️ Cognitive Decline Alert: ${data.patientName} declined by ${data.declinePercent}%`, {
          icon: '🧠',
          duration: 8000,
          style: { background: '#78350f', color: '#fff', border: '1px solid #fbbf24' }
        });
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

export default SocketContext;
