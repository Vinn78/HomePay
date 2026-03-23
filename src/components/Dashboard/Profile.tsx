import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Input, cn } from '../Common';
import { LogOut, User, Mail, Phone, Shield, ChevronRight, Settings, CreditCard, Save, Download, Smartphone, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Profile: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const [upiId, setUpiId] = useState(profile?.upiId || '');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'account' | 'privacy' | 'install' | null>(null);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  const [editForm, setEditForm] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    upiId: profile?.upiId || '',
  });

  const [privacyForm, setPrivacyForm] = useState({
    visibility: profile?.visibility ?? true,
    twoFactorAuth: profile?.twoFactorAuth ?? false,
    biometricLock: profile?.biometricLock ?? false,
  });

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        displayName: editForm.name,
        phone: editForm.phone,
        upiId: editForm.upiId,
      });
      setActiveModal(null);
    } catch (err) {
      console.error('Error updating account:', err);
      alert('Failed to update account settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrivacy = async (field: string, value: boolean) => {
    const newPrivacy = { ...privacyForm, [field]: value };
    setPrivacyForm(newPrivacy);
    try {
      await updateProfile({ [field]: value });
    } catch (err) {
      console.error('Failed to update privacy setting:', err);
    }
  };

  const menuItems = [
    { icon: Settings, label: 'Account Settings', color: 'text-zinc-600', onClick: () => setActiveModal('account') },
    { icon: Shield, label: 'Privacy & Security', color: 'text-zinc-600', onClick: () => setActiveModal('privacy') },
    ...(!isStandalone ? [{ icon: Download, label: 'Install App', color: 'text-blue-600', onClick: () => setActiveModal('install') }] : []),
    { icon: LogOut, label: 'Sign Out', color: 'text-red-500', onClick: handleSignOut },
  ];

  const getMemberSince = () => {
    if (!profile?.createdAt) return '2026';
    const d = (profile.createdAt as any).toDate ? (profile.createdAt as any).toDate() : new Date(profile.createdAt);
    return isNaN(d.getTime()) ? '2026' : d.getFullYear();
  };

  return (
    <div className="p-6 space-y-8 pb-24">
      <header className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="h-24 w-24 rounded-3xl bg-black text-white flex items-center justify-center shadow-xl"
        >
          <User className="h-12 w-12" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile?.name || 'User'}</h1>
          <p className="text-sm text-zinc-500">Member since {getMemberSince()}</p>
        </div>
      </header>

      <Card className="p-0 overflow-hidden divide-y divide-zinc-50">
        <div className="p-4 flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500">
            <Mail className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Email</p>
            <p className="text-sm font-medium text-zinc-900">{profile?.email}</p>
          </div>
        </div>
        <div className="p-4 flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500">
            <Phone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Phone</p>
            <p className="text-sm font-medium text-zinc-900">{profile?.phone || 'Not provided'}</p>
          </div>
        </div>
        <div className="p-4 flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">UPI ID</p>
            <p className="text-sm font-medium text-zinc-900">{profile?.upiId || 'Not set'}</p>
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className={cn("h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center", item.color)}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className={cn("font-semibold", item.color)}>{item.label}</span>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-300" />
          </button>
        ))}
      </section>

      {/* Account Settings Modal */}
      <AnimatePresence>
        {activeModal === 'account' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <h2 className="mb-4 text-xl font-bold">Account Settings</h2>
              <form onSubmit={handleUpdateAccount} className="space-y-4">
                <Input
                  label="Full Name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
                <Input
                  label="Phone Number"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
                <Input
                  label="UPI ID"
                  value={editForm.upiId}
                  onChange={(e) => setEditForm({ ...editForm, upiId: e.target.value })}
                  placeholder="name@upi"
                />
                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" isLoading={loading}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy & Security Modal */}
      <AnimatePresence>
        {activeModal === 'privacy' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Privacy & Security</h2>
                <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-black">
                  <ChevronRight className="h-6 w-6 rotate-90" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Public Visibility</p>
                    <p className="text-xs text-zinc-500">Allow others to find you by email</p>
                  </div>
                  <button
                    onClick={() => handleUpdatePrivacy('visibility', !privacyForm.visibility)}
                    className={cn(
                      "h-6 w-11 rounded-full transition-colors relative",
                      privacyForm.visibility ? "bg-black" : "bg-zinc-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                      privacyForm.visibility ? "left-6" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <p className="font-semibold">Two-Factor Auth</p>
                    <p className="text-xs text-zinc-500">Add an extra layer of security</p>
                  </div>
                  <button
                    disabled
                    className="h-6 w-11 rounded-full bg-zinc-200 relative cursor-not-allowed"
                  >
                    <div className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white" />
                  </button>
                </div>

                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <p className="font-semibold">Biometric Lock</p>
                    <p className="text-xs text-zinc-500">Use FaceID or Fingerprint</p>
                  </div>
                  <button
                    disabled
                    className="h-6 w-11 rounded-full bg-zinc-200 relative cursor-not-allowed"
                  >
                    <div className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white" />
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setActiveModal(null)}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Install App Modal */}
      <AnimatePresence>
        {activeModal === 'install' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <h2 className="mb-4 text-xl font-bold">Install HomePay</h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 flex-shrink-0">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">iOS (iPhone/iPad)</p>
                    <p className="text-sm text-zinc-500">1. Open in Safari</p>
                    <p className="text-sm text-zinc-500">2. Tap the Share button <Share className="inline h-3 w-3" /></p>
                    <p className="text-sm text-zinc-500">3. Select "Add to Home Screen"</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 flex-shrink-0">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">Android</p>
                    <p className="text-sm text-zinc-500">1. Open in Chrome</p>
                    <p className="text-sm text-zinc-500">2. Tap the menu (three dots)</p>
                    <p className="text-sm text-zinc-500">3. Select "Install app" or "Add to Home screen"</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-xs font-medium text-zinc-500 text-center">
                    Use the link below to share with others:
                  </p>
                  <p className="mt-2 text-[10px] font-mono text-center break-all text-zinc-400">
                    https://ais-pre-5xa23cc2mkdcbygcd2r6ac-667026698738.asia-southeast1.run.app
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setActiveModal(null)}
                >
                  Got it
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="text-center py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">HomePay v1.0.0</p>
      </footer>
    </div>
  );
};
