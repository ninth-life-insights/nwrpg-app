// src/utils/authErrors.js

export function getAuthErrorMessage(error, mode = 'login') {
  const code = error?.code;

  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with that email address.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Try again.';
    case 'auth/invalid-email':
      return "That doesn't look like a valid email address.";
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Connection problem. Check your internet.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    default:
      return mode === 'signup'
        ? "Couldn't create your account. Try again."
        : "Couldn't sign in. Try again.";
  }
}
