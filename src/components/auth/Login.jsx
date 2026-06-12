// Login.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAuthErrorMessage } from '../../utils/authErrors';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, resetPassword } = useAuth();

  const navigate = useNavigate();

      const signUpButtonClick = () => {
          navigate('/sign-up');
      };

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError('');
      setResetSent(false);
      setLoading(true);
      await login(email, password);
      navigate('/home');
    } catch (error) {
      setError(getAuthErrorMessage(error, 'login'));
      console.error('Login error:', error);
    }

    setLoading(false);
  }

  async function handleForgotPassword() {
    setError('');
    setResetSent(false);
    if (!email) {
      setError('Enter your email above, then tap Forgot password.');
      return;
    }
    try {
      await resetPassword(email);
      // Firebase v12 doesn't reveal whether the email is registered, so we
      // always show the same confirmation — by design.
      setResetSent(true);
    } catch (error) {
      setError(getAuthErrorMessage(error, 'reset'));
      console.error('Password reset error:', error);
    }
  }

  return (
    <div >
      <div className="auth-card">

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

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
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={handleForgotPassword}
              className="auth-button secondary forgot-password-link"
            >
              Forgot password?
            </button>
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