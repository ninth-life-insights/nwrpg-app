// Login.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAuthErrorMessage, getAuthErrorField } from '../../utils/authErrors';
import ErrorMessage from '../ui/ErrorMessage';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, resetPassword } = useAuth();

  const navigate = useNavigate();

      const signUpButtonClick = () => {
          navigate('/sign-up');
      };

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setEmailError('');
      setError('');
      setResetSent(false);
      setLoading(true);
      await login(email, password);
      navigate('/home');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'login');
      if (getAuthErrorField(err) === 'email') {
        setEmailError(message);
      } else {
        setError(message);
      }
      console.error('Login error:', err);
    }

    setLoading(false);
  }

  async function handleForgotPassword() {
    setEmailError('');
    setError('');
    setResetSent(false);
    if (!email) {
      setEmailError('Enter your email above, then tap Forgot password.');
      return;
    }
    try {
      await resetPassword(email);
      // Firebase v12 doesn't reveal whether the email is registered, so we
      // always show the same confirmation — by design.
      setResetSent(true);
    } catch (err) {
      const message = getAuthErrorMessage(err, 'reset');
      if (getAuthErrorField(err) === 'email') {
        setEmailError(message);
      } else {
        setError(message);
      }
      console.error('Password reset error:', err);
    }
  }

  return (
    <div >
      <div className="auth-card">

        {resetSent && (
          <div className="success-message">
            Check your email for a link to reset your password.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              placeholder="your.email@example.com"
            />
            <ErrorMessage message={emailError} className="auth-error" />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-icons-outlined">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="auth-button secondary forgot-password-link"
            >
              Forgot password?
            </button>
            <ErrorMessage message={error} className="auth-error" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-button primary"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        
        <div className="auth-footer">
          <span className="footer-text">Don't have an account? </span>
          <button onClick={signUpButtonClick}
            
            className="auth-button secondary"
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}