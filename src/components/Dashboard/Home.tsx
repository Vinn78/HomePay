import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, or } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { PaymentRequest } from '../../types';
import { Card, Button, cn } from '../Common';
import { ArrowUpRight, ArrowDownLeft, Bell, Wallet } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Notifications } from './Notifications';

export const Home: React.FC = () => {
  const { user, profile } = useAuth();
  const [recentRequests, setRecentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !user.email) return;

    const userEmail = user.email.toLowerCase().trim();

    // Query for requests where user is sender OR recipient
    const q = query(
      collection(db, 'paymentRequests'),
      or(
        where('senderId', '==', user.uid),
        where('recipientEmail', '==', userEmail)
      ),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as PaymentRequest));
      
      setRecentRequests(requests);
      setLoading(false);
    }, (error) => {
      console.error('Home snapshot error:', error);
      setLoading(false);
    });

    // Query for notifications (personal and global)
    const nq = query(
      collection(db, 'notifications'),
      or(
        where('recipientEmail', '==', userEmail),
        where('isGlobal', '==', true)
      ),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribeNotifications = onSnapshot(nq, (snapshot) => {
      const unread = snapshot.docs.filter(doc => {
        const data = doc.data();
        if (data.isGlobal) {
          return !data.readBy?.includes(user.uid);
        }
        return !data.read;
      });
      setUnreadCount(unread.length);
    }, (error) => {
      console.error('Home notifications snapshot error:', error);
    });

    return () => {
      unsubscribe();
      unsubscribeNotifications();
    };
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'accepted': return 'bg-blue-100 text-blue-700';
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-zinc-100 text-zinc-700';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return 'Just now';
    return formatDistanceToNow(d, { addSuffix: true });
  };

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hello, {profile?.name?.split(' ')[0] || 'User'}</h1>
          <p className="text-sm text-zinc-500">Welcome back to HomePay</p>
        </div>
        <button
          onClick={() => setIsNotificationsOpen(true)}
          className="relative rounded-full bg-white p-2 shadow-sm border border-zinc-100 hover:bg-zinc-50 transition-colors"
        >
          <Bell className="h-5 w-5 text-zinc-600" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
          )}
        </button>
      </header>

      <Card className="bg-black text-white border-none p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 opacity-60" />
            <span className="text-sm font-medium opacity-60 uppercase tracking-wider">Total Balance</span>
          </div>
          <span className="text-xs font-mono opacity-40">**** 4242</span>
        </div>
        <div className="text-4xl font-bold tracking-tighter">₹{(profile?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="flex space-x-2">
          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-2/3 bg-white/40" />
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <button className="text-xs font-medium text-zinc-500 uppercase tracking-wider hover:text-black">See All</button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-full animate-pulse rounded-2xl bg-zinc-200" />
            ))}
          </div>
        ) : recentRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
              <ArrowUpRight className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500">No recent requests found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentRequests.map((req) => (
              <Card key={req.id} className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                    req.senderId === user?.uid ? "bg-zinc-100 text-zinc-600" : "bg-black text-white"
                  )}>
                    {req.senderId === user?.uid ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 truncate">
                      {req.senderId === user?.uid ? `To: ${req.recipientEmail.toLowerCase().trim()}` : `From: ${req.senderName}`}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(req.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="font-bold text-zinc-900">₹{req.amount.toFixed(2)}</p>
                  <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", getStatusColor(req.status))}>
                    {req.status}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {isNotificationsOpen && (
        <Notifications onClose={() => setIsNotificationsOpen(false)} />
      )}
    </div>
  );
};
