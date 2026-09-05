import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { FiX, FiCheck, FiTrash2 } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function NotificationCenter({ isOpen, onClose }) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loading
  } = useNotifications();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end select-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl z-10 animate-slide-left">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-850">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        {notifications.length > 0 && (
          <div className="flex justify-between items-center px-6 py-2.5 bg-slate-950/40 border-b border-slate-850 text-xs">
            <button
              onClick={markAllAsRead}
              className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <FiCheck /> Mark all read
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
              <span className="animate-spin mr-2">🌀</span> Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center gap-2">
              <span className="text-3xl">🔔</span>
              <p>You have no notifications yet.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const priorityBorder = 
                n.priority === 'critical' ? 'border-rose-500' :
                n.priority === 'high' ? 'border-orange-500' : 
                n.isRead ? 'border-slate-800' : 'border-blue-500';

              return (
                <div 
                  key={n._id}
                  className={`bg-slate-950/30 hover:bg-slate-950/60 border rounded-2xl p-4 transition-all flex flex-col gap-1.5 ${priorityBorder}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-xs font-black ${n.isRead ? 'text-slate-400' : 'text-white'}`}>
                      {n.title}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.isRead && (
                        <button
                          onClick={() => markAsRead(n._id)}
                          className="text-blue-400 hover:text-blue-300 p-1 hover:bg-slate-800 rounded transition cursor-pointer"
                          title="Mark as Read"
                        >
                          <FiCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(n._id)}
                        className="text-slate-500 hover:text-rose-400 p-1 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Delete"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {n.message}
                  </p>

                  <div className="flex justify-between items-center mt-1 text-4xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {n.priority !== 'normal' && (
                      <span className={n.priority === 'critical' ? 'text-rose-400 font-black animate-pulse' : 'text-orange-400'}>
                        {n.priority}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-850 bg-slate-950/20">
          <Link
            to="/notifications"
            onClick={onClose}
            className="block text-center py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            View Notification History
          </Link>
        </div>
      </div>
    </div>
  );
}
