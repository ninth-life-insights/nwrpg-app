
// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDHPunycrzFRCRVw5xM-yZ7Ul6MnzgfgP8",
  authDomain: "nwrpg-app.firebaseapp.com",
  projectId: "nwrpg-app",
  storageBucket: "nwrpg-app.firebasestorage.app",
  messagingSenderId: "230659620839",
  appId: "1:230659620839:web:4037f1f42528f6c67a8742",
  measurementId: "G-C97P4Z86NG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;