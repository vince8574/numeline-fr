import { initializeApp } from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

let appInitialized = false;

export function ensureFirebase() {
  if (!appInitialized) {
    initializeApp(firebaseConfig);
    appInitialized = true;
  }
}

export function getFirestore() {
  ensureFirebase();
  return firestore();
}
