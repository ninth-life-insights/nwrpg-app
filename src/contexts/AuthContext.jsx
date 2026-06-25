// AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail
} from 'firebase/auth';
import { doc, getDoc, terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { auth, db } from '../services/firebase/config';
import { createUserProfile } from '../services/userService';
import { updateThemeColor } from '../utils/themeUtils';
import { setSentryUser } from '../utils/sentry';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [hasCharacter, setHasCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Sign up function
  async function signup(email, password) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Create user profile in Firestore
    await createUserProfile(result.user.uid, email);
    // Fire-and-forget the verification email — failure here (rate limit,
    // transient network) shouldn't block account creation. User can resend
    // from the banner on home.
    sendEmailVerification(result.user).catch((err) => {
      console.warn('Could not send verification email at signup:', err);
    });
    return result;
  }

  // Login function
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Password reset — Firebase sends the email and hosts the reset page.
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Resend the email-verification message to the currently signed-in user.
  function resendVerificationEmail() {
    if (!auth.currentUser) return Promise.reject(new Error('No signed-in user'));
    return sendEmailVerification(auth.currentUser);
  }

  // Re-authenticate, then send a verification email to the new address.
  // The actual email change happens only when the user clicks the link in
  // the new inbox — until then, their current email keeps working.
  async function changeEmail(currentPassword, newEmail) {
    const user = auth.currentUser;
    if (!user) throw new Error('No signed-in user');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await verifyBeforeUpdateEmail(user, newEmail);
  }

  // Re-authenticate, then change the password. User stays signed in.
  async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('No signed-in user');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  }

  // Logout function
  async function logout() {
    await signOut(auth);
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (err) {
      // Failures here (e.g. other tabs holding the cache open) shouldn't block sign-out.
      console.warn('Could not clear Firestore cache on logout:', err);
    }
    window.location.reload();
  }

  // Listen for authentication state changes
  useEffect(() => {
    let didFire = false;
    const timer = setTimeout(() => {
      if (!didFire) {
        setAuthError(true);
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      didFire = true;
      clearTimeout(timer);
      setCurrentUser(user);
      setSentryUser(user);
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Load the user's profile doc when they log in: applies their theme color
  // and records whether character creation is done. hasCharacter gates the
  // route wrappers so a fresh signup goes straight to /character-creation
  // without flashing /home in between.
  useEffect(() => {
    if (!currentUser) {
      setHasCharacter(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (cancelled) return;
        const character = userDoc.exists() ? userDoc.data().character : null;
        if (character?.color) updateThemeColor(character.color);
        setHasCharacter(Boolean(character));
      } catch (error) {
        console.error('Error loading user profile:', error);
        // Default to true on fetch failure so existing users aren't bounced
        // into character creation. New signups still reach /character-creation
        // via the imperative navigate in Signup.jsx.
        if (!cancelled) setHasCharacter(true);
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser]);

  const value = {
    currentUser,
    hasCharacter,
    signup,
    login,
    logout,
    resetPassword,
    resendVerificationEmail,
    changeEmail,
    changePassword
  };

  if (authError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: '16px',
        padding: '24px', textAlign: 'center'
      }}>
        <p style={{ margin: 0, color: '#4b5563' }}>
          Couldn't connect to sign you in. Check your connection and tap Retry.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            background: '#3b82f6', color: '#fff', fontSize: '1rem', cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}