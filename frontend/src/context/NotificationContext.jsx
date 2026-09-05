/**
 * NOTIFICATION CONTEXT — NotificationContext.jsx
 * =================================================
 * Maintains global state for notifications, badge counts, and hooks into Socket.io.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { notificationService } from '../api/notification.service';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { socket } = useSocket() || {};
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationService.getUnreadCount();
      if (res.success) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const fetchNotifications = async (params = {}) => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await notificationService.getNotifications(params);
      if (res.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const res = await notificationService.markAsRead(id);
      if (res.success) {
        setNotifications(prev =>
          prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await notificationService.markAllAsRead();
      if (res.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const res = await notificationService.deleteNotification(id);
      if (res.success) {
        const deleted = notifications.find(n => n._id === id);
        setNotifications(prev => prev.filter(n => n._id !== id));
        if (deleted && !deleted.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        toast.success('Notification deleted');
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  // Sync initial stats
  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      fetchNotifications({ limit: 10 });
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated]);

  // Connect to socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 9)]);
      setUnreadCount(prev => prev + 1);

      // Play subtle notification chime or speak alert if patient
      if (user?.role === 'patient') {
        const synth = window.speechSynthesis;
        if (synth && 'speechSynthesis' in window) {
          let text = notification.title;
          if (notification.type === 'missed_dose' || notification.type === 'escalation') {
            text = `Attention. ${notification.title}. ${notification.message}`;
          }
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.85; // Speak slower for cognitive accessibility
          synth.speak(utterance);
        }
      }
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
