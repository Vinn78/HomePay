import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, deleteDoc, or, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { X, Bell, Trash2, CheckCircle2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { Card, Button, cn } from '../Common';
import { Notification } from '../../types';

interface NotificationsProps {
  onClose: () => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.email) return;

    const userEmail = user.email.toLowerCase().trim();

    const q = query(
      collection(db, 'notifications'),
      or(
        where('recipientEmail', '==', userEmail),
        where('isGlobal', '==', true)
      ),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      console.error('Notifications snapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const isRead = (n: Notification) => {
    if (n.isGlobal) {
      return n.readBy?.includes(user?.uid || '');
    }
    return n.read;
  };

  const markAsRead = async (n: Notification) => {
    if (!user) return;
    try {
      if (n.isGlobal) {
        await updateDoc(doc(db, 'notifications', n.id), {
          readBy: arrayUnion(user.uid)
        });
      } else {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !isRead(n));
    for (const n of unread) {
      await markAsRead(n);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    return formatDistanceToNow(d, { addSuffix: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50 md:inset-auto md:right-6 md:top-20 md:h-[600px] md:w-[400px] md:rounded-3xl md:shadow-2xl md:border md:border-zinc-200">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white p-4 md:rounded-t-3xl">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5 text-black" />
          <h2 className="text-lg font-bold">Notifications</h2>
        </div>
        <div className="flex items-center space-x-2">
          {notifications.some(n => !isRead(n)) && (
            <button
              onClick={markAllAsRead}
              className="text-xs font-bold text-blue-600 hover:opacity-70"
            >
              Mark all as read
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 w-full animate-pulse rounded-2xl bg-zinc-200" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center">
              <Bell className="h-8 w-8 text-zinc-300" />
            </div>
            <p className="text-zinc-500">No notifications yet</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                layout
              >
                <Card className={cn(
                  "relative p-4 transition-all",
                  !isRead(n) ? "border-l-4 border-l-black bg-white shadow-md" : "bg-zinc-50/50 opacity-80"
                )}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1 pr-8">
                      <div className="flex items-center space-x-2">
                        {n.isGlobal && <Zap className="h-3 w-3 text-red-500 fill-red-500" />}
                        <h3 className="text-sm font-bold">{n.title}</h3>
                      </div>
                      <p className="text-sm text-zinc-600 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                        {formatDate(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col space-y-2">
                      {!isRead(n) && (
                        <button
                          onClick={() => markAsRead(n)}
                          className="text-zinc-400 hover:text-emerald-500"
                          title="Mark as read"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {!n.isGlobal && (
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="text-zinc-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
