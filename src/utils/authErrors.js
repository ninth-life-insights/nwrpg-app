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
      return 'Password must be at least 8 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    case 'auth/requires-recent-login':
      return 'For your security, please log out and back in, then try again.';
    case 'auth/operation-not-allowed':
      return "That change didn't go through. Try again in a minute.";
    default:
      if (mode === 'signup') return "Your account didn't create. Try again.";
      if (mode === 'reset') return "That reset email didn't send. Try again.";
      if (mode === 'change-email') return "Your email didn't update. Try again.";
      if (mode === 'change-password') return "Your password didn't update. Try again.";
      return "Sign-in didn't go through. Try again.";
  }
}

// Which form field a Firebase auth error code belongs to, so the inline
// error renders next to its associated input. Returns null for codes that
// aren't field-specific (network failure, too-many-requests, etc.) — the
// caller decides where those land. Note: `auth/invalid-credential` is
// intentionally null since Firebase v12 won't say whether the email or the
// password is wrong; login forms typically render that one under password.
export function getAuthErrorField(error) {
  const code = error?.code;
  switch (code) {
    case 'auth/email-already-in-use':
    case 'auth/invalid-email':
      return 'email';
    case 'auth/weak-password':
      return 'password';
    default:
      return null;
  }
}
