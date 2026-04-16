// AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase/config';
import { createUserProfile } from '../services/userService';
import { updateThemeColor } from '../utils/themeUtils';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Sign up function
  async function signup(email, password) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Create user profile in Firestore
    await createUserProfile(result.user.uid, email);
    return result;
  }

  // Login function
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Logout function
  function logout() {
    return signOut(auth);
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
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Load and apply user's theme color when they log in
  useEffect(() => {
    const loadUserTheme = async () => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.character?.color) {
              updateThemeColor(userData.character.color);
            }
          }
        } catch (error) {
          console.error('Error loading user theme:', error);
        }
      }
    };

    loadUserTheme();
  }, [currentUser]);

  const value = {
    currentUser,
    signup,
    login,
    logout
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