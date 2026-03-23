import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button, Input, Card, cn } from '../Common';
import { Send, User, Mail, IndianRupee, MessageSquare, QrCode, Plus, Trash2, AlertTriangle, Clock, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { QRScanner } from './QRScanner';
import { RequestPriority, Contact } from '../../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',  
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
};

export const SendRequest: React.FC = () => {
  const { user, profile } = useAuth();
  const { sendInAppNotification } = useNotifications();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('medium');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', upiId: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'contacts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Contact));
      setContacts(contactsData);
    }, (error) => {
      console.error('Contacts snapshot error:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setLoading(true);
    try {
      const trimmedEmail = recipientEmail.toLowerCase().trim();
      await addDoc(collection(db, 'paymentRequests'), {
        senderId: user.uid,
        senderName: profile.name,
        senderEmail: user.email?.toLowerCase() || '',
        senderUpiId: profile.upiId || '',
        recipientEmail: trimmedEmail,
        amount: parseFloat(amount),
        note: note.trim(),
        status: 'pending',
        priority,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Send in-app notification
      const isImmediate = priority === 'IMMEDIATE';

const title = `${isImmediate ? 'IMMEDIATE: ' : ''}New Payment Request`;
const message = `${profile?.name || user?.email} requested ₹${amount} from you. Priority: ${priority.toUpperCase()}`;

if (isImmediate) {
  // 🔥 Notify ALL contacts
  await Promise.all(
    contacts.map(contact =>
      sendInAppNotification(
        contact.email.toLowerCase().trim(),
        title,
        message,
        true
      )
    )
  );
} else {
  // ✅ Notify only selected user
  await sendInAppNotification(
    trimmedEmail,
    title,
    message,
    false
  );
}
      setSuccess(true);
      setTimeout(() => navigate('/requests'), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'paymentRequests');
      alert('Failed to send request. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'users', user.uid, 'contacts'), {
        ...newContact,
        createdAt: serverTimestamp(),
      });
      setIsAddContactOpen(false);
      setNewContact({ name: '', email: '', upiId: '' });
    } catch (err) {
      console.error('Error adding contact:', err);
      alert('Failed to add contact.');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'contacts', contactId));
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

  const handleQRScan = (data: string) => {
    // Expected format: email:upiId or just email or just upiId
    // For now, let's assume it's a JSON string or a simple string
    try {
      const parsed = JSON.parse(data);
      if (parsed.email) setRecipientEmail(parsed.email);
      if (parsed.amount) setAmount(parsed.amount.toString());
      if (parsed.note) setNote(parsed.note);
    } catch {
      if (data.includes('@')) {
        setRecipientEmail(data);
      } else {
        // Assume it's a UPI ID or something else
        setNote(prev => prev ? `${prev}\nUPI: ${data}` : `UPI: ${data}`);
      }
    }
    setIsScannerOpen(false);
  };

  const priorities: { value: RequestPriority; label: string; icon: any; color: string }[] = [
    { value: 'low', label: 'Low', icon: Clock, color: 'text-zinc-500 bg-zinc-100' },
    { value: 'medium', label: 'Medium', icon: MessageSquare, color: 'text-blue-500 bg-blue-100' },
    { value: 'high', label: 'High', icon: AlertTriangle, color: 'text-amber-500 bg-amber-100' },
    { value: 'IMMEDIATE', label: 'Immediate', icon: Zap, color: 'text-red-500 bg-red-100' },
  ];

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"
        >
          <Send className="h-12 w-12" />
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Request Sent!</h2>
          <p className="text-zinc-500">Your payment request has been sent to {recipientEmail}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Send Request</h1>
          <p className="text-sm text-zinc-500">Request money from anyone via email</p>
        </div>
        <button
          onClick={() => setIsScannerOpen(true)}
          className="rounded-full bg-black p-3 text-white shadow-lg hover:scale-110 transition-transform"
        >
          <QrCode className="h-6 w-6" />
        </button>
      </header>

      <form onSubmit={handleSend} className="space-y-6">
        <Card className="space-y-4 p-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Recipient Email"
              type="email"
              className="pl-10"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Amount (e.g. 500.00)"
              type="number"
              step="0.01"
              min="0.01"
              className="pl-10 text-lg font-bold"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Priority</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex items-center justify-center space-x-2 rounded-xl border-2 p-3 transition-all",
                    priority === p.value
                      ? "border-black bg-black text-white"
                      : "border-zinc-100 bg-zinc-50 text-zinc-600 hover:border-zinc-200"
                  )}
                >
                  <p.icon className={cn("h-4 w-4", priority === p.value ? "text-white" : p.color.split(' ')[0])} />
                  <span className="text-xs font-bold">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
            <textarea
              placeholder="Add a note (optional)"
              className="flex min-h-[100px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 pl-10 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </Card>

        <Button type="submit" className="w-full h-14 text-lg" isLoading={loading}>
          Send Payment Request
        </Button>
      </form>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">My Contacts</h3>
          <button
            onClick={() => setIsAddContactOpen(true)}
            className="flex items-center space-x-1 text-xs font-bold text-black hover:opacity-70"
          >
            <Plus className="h-4 w-4" />
            <span>Add New</span>
          </button>
        </div>

        {contacts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-100 p-8 text-center">
            <p className="text-sm text-zinc-400">No contacts saved yet.</p>
          </div>
        ) : (
          <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide">
            {contacts.map((contact) => (
              <div key={contact.id} className="relative group min-w-[80px]">
                <button
                  type="button"
                  className="flex flex-col items-center space-y-2 w-full"
                  onClick={() => setRecipientEmail(contact.email)}
                >
                  <div className="h-16 w-16 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600 hover:bg-zinc-200 transition-colors">
                    <User className="h-8 w-8" />
                  </div>
                  <span className="text-xs font-medium text-zinc-600 truncate w-full text-center">{contact.name}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteContact(contact.id);
                  }}
                  className="absolute -top-1 -right-1 hidden h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-sm group-hover:flex hover:bg-red-200"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* QR Scanner Modal */}
      {isScannerOpen && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Add Contact Modal */}
      <AnimatePresence>
        {isAddContactOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <h2 className="mb-4 text-xl font-bold">Add Contact</h2>
              <form onSubmit={handleAddContact} className="space-y-4">
                <Input
                  label="Name"
                  placeholder="Contact Name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="contact@example.com"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  required
                />
                <Input
                  label="UPI ID (Optional)"
                  placeholder="user@upi"
                  value={newContact.upiId}
                  onChange={(e) => setNewContact({ ...newContact, upiId: e.target.value })}
                />
                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setIsAddContactOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Save Contact
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
