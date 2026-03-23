import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, serverTimestamp, or, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { PaymentRequest } from '../../types';
import { Card, Button, cn } from '../Common';
import { Check, X, CreditCard, Clock, Filter, QrCode, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';

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

export const Requests: React.FC = () => {
  const { user } = useAuth();
  const { sendInAppNotification } = useNotifications();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (!user || !user.email) return;

    const userEmail = user.email.toLowerCase().trim();

    const q = query(
      collection(db, 'paymentRequests'),
      or(
        where('senderId', '==', user.uid),
        where('recipientEmail', '==', userEmail)
      ),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRequests = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as PaymentRequest));
      
      setRequests(allRequests);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'paymentRequests');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleStatusUpdate = async (requestId: string, newStatus: 'accepted' | 'rejected' | 'paid') => {
    try {
      const requestRef = doc(db, 'paymentRequests', requestId);
      const request = requests.find(r => r.id === requestId);
      
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      if (request) {
        // Notify the sender about the status update
        // If the recipient is updating the status, the sender needs to be notified
        if (request.recipientEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim()) {
          await sendInAppNotification(
            request.senderEmail.toLowerCase().trim(),
            'Request Update',
            `${user.email} has ${newStatus} your request for ₹${request.amount}.`
          );
        }
      }

      if (newStatus === 'paid') {
        setShowPaymentModal(false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `paymentRequests/${requestId}`);
      alert('Failed to update request status.');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete Request',
      message: 'Are you sure you want to delete this request? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'paymentRequests', requestId));
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `paymentRequests/${requestId}`);
          alert('Failed to delete request.');
        }
      }
    });
  };

  const handleClearHistory = async () => {
    setConfirmModal({
      show: true,
      title: 'Clear History',
      message: `Are you sure you want to clear all ${filter === 'all' ? '' : filter} requests? This action cannot be undone.`,
      onConfirm: async () => {
        setIsDeletingAll(true);
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const batch = writeBatch(db);
          filteredRequests.forEach((req) => {
            batch.delete(doc(db, 'paymentRequests', req.id));
          });
          await batch.commit();
          setConfirmModal(prev => ({ ...prev, show: false, isLoading: false }));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'paymentRequests (batch)');
          alert('Failed to clear history.');
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        } finally {
          setIsDeletingAll(false);
        }
      }
    });
  };

  const generateUPILink = (req: PaymentRequest) => {
    const upiId = req.senderUpiId || 'payment@upi';
    const name = encodeURIComponent(req.senderName);
    const amount = req.amount.toFixed(2);
    const note = encodeURIComponent(req.note || 'Payment via HomePay');
    return `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
  };

  const handlePayClick = (req: PaymentRequest) => {
    setSelectedRequest(req);
    setShowPaymentModal(true);
    
    // Attempt to open UPI app directly on mobile
    const upiLink = generateUPILink(req);
    window.location.href = upiLink;
  };

  const filteredRequests = requests.filter((req) => {
    const userEmail = user?.email?.toLowerCase().trim();
    if (filter === 'received') return req.recipientEmail.toLowerCase().trim() === userEmail;
    if (filter === 'sent') return req.senderId === user?.uid;
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'accepted': return <Check className="h-4 w-4 text-blue-500" />;
      case 'paid': return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case 'rejected': return <X className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return 'Just now';
    return formatDistanceToNow(d, { addSuffix: true });
  };

  return (
    <div className="p-6 space-y-6 pb-24">
      <header className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Requests</h1>
          {filteredRequests.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearHistory}
              isLoading={isDeletingAll}
              className="text-red-500 border-red-100 hover:bg-red-50 h-8 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2 rounded-xl bg-zinc-100 p-1 w-fit">
          {(['all', 'received', 'sent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all",
                filter === f ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 w-full animate-pulse rounded-2xl bg-zinc-200" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center">
            <Filter className="h-8 w-8 text-zinc-300" />
          </div>
          <p className="text-zinc-500">No requests found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <Card key={req.id} className="space-y-4 relative group">
              <button 
                onClick={() => handleDeleteRequest(req.id)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-50 text-zinc-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete Request"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="flex items-start justify-between min-w-0 pr-8">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                      {req.senderId === user?.uid ? 'Sent' : 'Received'}
                    </span>
                    {getStatusIcon(req.status)}
                  </div>
                  <p className="text-lg font-bold text-zinc-900 truncate">
                    {req.senderId === user?.uid ? `To: ${req.recipientEmail.toLowerCase().trim()}` : `From: ${req.senderName}`}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(req.createdAt)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-2xl font-black text-zinc-900">₹{req.amount.toFixed(2)}</p>
                </div>
              </div>

              {req.note && (
                <div className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 italic">
                  "{req.note}"
                </div>
              )}

              {req.recipientEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim() && req.status === 'pending' && (
                <div className="flex space-x-2 pt-2">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => handleStatusUpdate(req.id, 'accepted')}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleStatusUpdate(req.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              )}

              {req.recipientEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim() && req.status === 'accepted' && (
                <Button
                  variant="primary"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handlePayClick(req)}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay Now
                </Button>
              )}

              {req.status === 'paid' && (
                <div className="flex items-center justify-center rounded-xl bg-emerald-50 py-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Transaction Completed
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl p-8 space-y-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">Pay {selectedRequest.senderName}</h2>
                <p className="text-3xl font-black tracking-tighter text-zinc-900">₹{selectedRequest.amount.toFixed(2)}</p>
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                <QRCodeSVG 
                  value={generateUPILink(selectedRequest)} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
                <div className="mt-4 flex items-center space-x-2 text-zinc-400">
                  <QrCode className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Scan with any UPI app</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  variant="primary" 
                  className="w-full h-12"
                  onClick={() => window.location.href = generateUPILink(selectedRequest)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open UPI App
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-12 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'paid')}
                >
                  <Check className="mr-2 h-4 w-4" />
                  I've Paid
                </Button>
              </div>

              <p className="text-[10px] text-center text-zinc-400 font-medium">
                UPI ID: {selectedRequest.senderUpiId || 'payment@upi'}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{confirmModal.title}</h3>
                  <p className="text-sm text-zinc-500">{confirmModal.message}</p>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <Button 
                  variant="primary" 
                  className="bg-red-500 hover:bg-red-600"
                  onClick={confirmModal.onConfirm}
                  isLoading={confirmModal.isLoading}
                >
                  Confirm Delete
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  disabled={confirmModal.isLoading}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
