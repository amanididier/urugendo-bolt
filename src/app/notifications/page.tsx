"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Ticket, Bus, Star, Megaphone, Check, Trash2 } from 'lucide-react';

const sampleNotifications = [
  {
    id: '1',
    title: 'Booking Confirmed!',
    message: 'Your bus from Kigali to Musanze on Apr 14 at 08:00 is confirmed. Code: XK7P2Q',
    type: 'booking' as const,
    read: false,
    createdAt: '2026-04-13T14:30:00',
  },
  {
    id: '2',
    title: 'Departing in 30 minutes',
    message: 'Your bus departs in 30 minutes from Nyabugogo Terminal. Please arrive early.',
    type: 'departure' as const,
    read: false,
    createdAt: '2026-04-13T07:30:00',
  },
  {
    id: '3',
    title: 'You earned 10 points!',
    message: 'Congratulations! You earned 10 points for completing your trip.',
    type: 'system' as const,
    read: true,
    createdAt: '2026-04-12T10:30:00',
  },
  {
    id: '4',
    title: 'New route available!',
    message: 'Great news! Kigali to Huye is now available. Book your seat today!',
    type: 'promo' as const,
    read: true,
    createdAt: '2026-04-10T09:00:00',
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(sampleNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = filter === 'unread' 
    ? notifications.filter(n => !n.read) 
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'booking': return <Ticket size={18} className="text-primary" />;
      case 'departure': return <Bus size={18} className="text-blue-600" />;
      case 'promo': return <Megaphone size={18} className="text-amber-600" />;
      case 'system': return <Star size={18} className="text-purple-600" />;
      default: return <Bell size={18} className="text-gray-600" />;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-white pb-[88px]">
      {/* Header */}
      <div className="pt-[60px] px-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold text-text-primary">Notifications</h1>
            <p className="text-[13px] text-text-muted">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="text-[13px] text-primary font-semibold"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${
              filter === 'all' 
                ? 'bg-primary text-white' 
                : 'bg-surface-secondary text-text-muted'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${
              filter === 'unread' 
                ? 'bg-primary text-white' 
                : 'bg-surface-secondary text-text-muted'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4 py-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={48} className="text-text-muted mx-auto mb-4" />
            <p className="text-[15px] text-text-muted">No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((notification, i) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl p-4 border transition-colors ${
                  notification.read 
                    ? 'bg-white border-border' 
                    : 'bg-primary-light border-primary/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notification.read ? 'bg-surface-secondary' : 'bg-primary/10'
                  }`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[14px] font-bold text-text-primary flex-1">
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-[12px] text-text-secondary mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-text-muted">
                        {getTimeAgo(notification.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-[11px] text-primary font-semibold"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-[11px] text-text-muted"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
