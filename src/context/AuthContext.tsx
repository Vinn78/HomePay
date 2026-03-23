import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Listen for real-time profile updates
        unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
            setLoading(false);
          } else if (currentUser.email) {
            // Create profile if it doesn't exist (e.g., social login)
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              name: currentUser.displayName || currentUser.email.split('@')[0],
              displayName: currentUser.displayName || currentUser.email.split('@')[0],
              email: currentUser.email.toLowerCase().trim(),
              photoURL: currentUser.photoURL || '',
              createdAt: serverTimestamp() as any,
              updatedAt: serverTimestamp() as any,
              balance: 0,
              upiId: '',
            };
            try {
              await setDoc(userRef, newProfile);
              // setProfile will be handled by the next snapshot
            } catch (err) {
              console.error('Error creating user profile:', err);
              setError('Failed to create user profile.');
              setLoading(false);
            }
          } else {
            setLoading(false);
          }
        }, (err) => {
          console.error('Error listening to user profile:', err);
          setError('Failed to load user profile.');
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      const updatedDoc = await getDoc(userRef);
      if (updatedDoc.exists()) {
        setProfile(updatedDoc.data() as UserProfile);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
