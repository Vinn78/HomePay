import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from '../firebase';
import { useAuth } from './AuthContext';
import { doc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, deleteDoc, or, orderBy, limit } from 'firebase/firestore';

interface NotificationContextType {
  token: string | null;
  requestPermission: () => Promise<void>;
  sendInAppNotification: (recipientEmail: string, title: string, message: string, isGlobal?: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  const requestPermission = async () => {
    try {
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        try {
          const currentToken = await getToken(messaging, {
            vapidKey: 'BD_mC7_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8_v8' // Placeholder
          });
          if (currentToken) {
            setToken(currentToken);
            if (user) {
              await updateDoc(doc(db, 'users', user.uid), {
                fcmToken: currentToken
              });
            }
          }
        } catch (tokenErr) {
          console.log('FCM Token error (likely missing VAPID key or SW):', tokenErr);
        }
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  const sendInAppNotification = async (recipientEmail: string, title: string, message: string, isGlobal: boolean = false) => {
    try {
      const notificationData: any = {
        title,
        message,
        createdAt: serverTimestamp(),
        read: false,
        isGlobal
      };

      if (!isGlobal) {
        notificationData.recipientEmail = recipientEmail.toLowerCase().trim();
      } else {
        notificationData.readBy = [];
      }

      await addDoc(collection(db, 'notifications'), notificationData);
    } catch (err) {
      console.error('Error sending in-app notification:', err);
    }
  };

  useEffect(() => {
    if (user && user.email) {
      requestPermission();

      // Listen for Firestore-based notifications (personal and global)
      const q = query(
        collection(db, 'notifications'),
        or(
          where('recipientEmail', '==', user.email.toLowerCase().trim()),
          where('isGlobal', '==', true)
        ),
        orderBy('createdAt', 'desc'),
        limit(1) // Only listen for the latest one to trigger browser notification
      );

      const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            
            // Check if already read (for global)
            const isRead = data.isGlobal ? data.readBy?.includes(user.uid) : data.read;
            if (isRead) return;

            if (Notification.permission === 'granted') {
              new Notification(data.title, {
                body: data.message,
                icon: '/firebase-logo.png'
              });
            }
            
            // For personal notifications, mark as read immediately for the browser notification
            if (!data.isGlobal) {
              updateDoc(change.doc.ref, { read: true });
            }
          }
        });
      }, (error) => {
        console.error('Notification snapshot error:', error);
      });

      return () => unsubscribeFirestore();
    }

    // FCM Foreground listener
    const unsubscribeFCM = onMessage(messaging, (payload) => {
      console.log('FCM Message received. ', payload);
      if (payload.notification && Notification.permission === 'granted') {
        new Notification(payload.notification.title || 'New Notification', {
          body: payload.notification.body,
          icon: '/firebase-logo.png'
        });
      }
    });

    return () => unsubscribeFCM();
  }, [user]);

  return (
    <NotificationContext.Provider value={{ token, requestPermission, sendInAppNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
