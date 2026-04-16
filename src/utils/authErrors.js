// src/utils/authErrors.js
//
// Firebase v12 intentionally conflates wrong-password and user-not-found into
// auth/invalid-credential to prevent user enumeration. We cannot distinguish
// between them after the Firebase call — client-side format validation only.

export function getAuthErrorMessage(error, mode = 'login') {
  const code = error?.code;

  switch (code) {
    // Firebase v12: single code for wrong password OR unknown email (by design)
    case 'auth/invalid-credential':
    // Older SDK fallbacks (kept for safety):
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Try again.';
    case 'auth/invalid-email':
      return "That doesn't look like a valid email address.";
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Connection problem. Check your internet.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    default:
      return mode === 'signup'
        ? "Your account didn't create. Try again."
        : "Sign-in didn't go through. Try again.";
  }
}
