import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAuthErrorMessage } from '../../utils/authErrors';
import ErrorMessage from '../ui/ErrorMessage';
import './Auth.css';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [error, setError] = useState('');
  const [tosError, setTosError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();

  const navigate = useNavigate();

      const logInButtonClick = () => {
          navigate('/log-in');
      };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setTosError('');

    if (password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    if (password !== confirmPassword) {
      return setError("Passwords don't match.");
    }

    if (!acceptedTos) {
      return setTosError('Please agree to the Terms and Privacy Policy to continue.');
    }

    try {
      setLoading(true);
      await signup(email, password);
      navigate('/character-creation');
    } catch (error) {
      setError(getAuthErrorMessage(error, 'signup'));
      console.error('Signup error:', error);
    }

    setLoading(false);
  }

  return (
      <div className="auth-card">

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
              placeholder="At least 6 characters"
            />
            <ErrorMessage message={error} className="auth-error" />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="form-input"
              placeholder="Confirm your password"
            />
          </div>

          <label className="tos-checkbox-row">
            <input
              type="checkbox"
              checked={acceptedTos}
              onChange={(e) => setAcceptedTos(e.target.checked)}
              className="tos-checkbox"
            />
            <span className="tos-checkbox-label">
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
            </span>
          </label>
          <ErrorMessage message={tosError} className="auth-error auth-error--tos" />

          <button
            type="submit"
            disabled={loading || !acceptedTos}
            className="auth-button primary"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        
        <div className="auth-footer">
          <span className="footer-text">Already have an account? </span>
          <button 
            onClick={logInButtonClick}
            className="auth-button secondary"
          >
            Log in
          </button>
        </div>
      </div>
  );
}