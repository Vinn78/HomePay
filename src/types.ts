export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'paid';
export type RequestPriority = 'low' | 'medium' | 'high' | 'IMMEDIATE';

export interface UserProfile {
  uid: string;
  name: string;
  displayName?: string;
  email: string;
  phone?: string;
  upiId?: string;
  photoURL?: string;
  fcmToken?: string;
  visibility?: boolean;
  twoFactorAuth?: boolean;
  biometricLock?: boolean;
  createdAt: any;
  updatedAt?: any;
  balance?: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  upiId?: string;
  createdAt: any;
}

export interface PaymentRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderUpiId?: string;
  recipientEmail: string;
  amount: number;
  note?: string;
  status: RequestStatus;
  priority: RequestPriority;
  createdAt: any;
  updatedAt: any;
}

export interface Notification {
  id: string;
  recipientEmail?: string;
  isGlobal?: boolean;
  readBy?: string[];
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
