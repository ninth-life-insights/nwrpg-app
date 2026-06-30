// Shared firebase-admin initialization for serverless functions.
// Expects FIREBASE_SERVICE_ACCOUNT to hold the service-account JSON (as a
// single-line string) in the Vercel environment. Cached across warm invocations.
import admin from 'firebase-admin';

let initialized = false;

export function getAdmin() {
  if (!initialized) {
    if (!admin.apps.length) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(raw)),
      });
    }
    initialized = true;
  }
  return admin;
}

export function getDb() {
  return getAdmin().firestore();
}
