import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(
  app,
  "ai-studio-090a78f7-e2cc-4415-bfce-3c847ffcd9b9"
);
export const auth = getAuth(app);
export const messaging = getMessaging(app);

export default app;
