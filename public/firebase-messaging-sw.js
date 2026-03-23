importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
firebase.initializeApp({
  apiKey: "AIzaSyAhRJqeQ4G6ghbkKiD9C-qJhed5-vw4eSI",
  authDomain: "gen-lang-client-0855330502.firebaseapp.com",
  projectId: "gen-lang-client-0855330502",
  storageBucket: "gen-lang-client-0855330502.firebasestorage.app",
  messagingSenderId: "139751404024",
  appId: "1:139751404024:web:65755398a9c012cf58660d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
