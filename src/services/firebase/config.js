import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDHPunycrzFRCRVw5xM-yZ7Ul6MnzgfgP8",
  authDomain: "nwrpg-app.firebaseapp.com",
  projectId: "nwrpg-app",
  storageBucket: "nwrpg-app.firebasestorage.app",
  messagingSenderId: "230659620839",
  appId: "1:230659620839:web:4037f1f42528f6c67a8742",
  measurementId: "G-C97P4Z86NG"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);

export default app;