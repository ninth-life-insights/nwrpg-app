import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAuthErrorMessage, getAuthErrorField } from '../../utils/authErrors';
import ErrorMessage from '../ui/ErrorMessage';
import './Auth.css';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [tosError, setTosError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signup } = useAuth();

  const navigate = useNavigate();

      const logInButtonClick = () => {
          navigate('/log-in');
      };

  async function handleSubmit(e) {
    e.preventDefault();
    setEmailError('');
    setError('');
    setTosError('');

    if (password.length < 8) {
      return setError('Password must be at least 8 characters.');
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
    } catch (err) {
      const message = getAuthErrorMessage(err, 'signup');
      if (getAuthErrorField(err) === 'email') {
        setEmailError(message);
      } else {
        setError(message);
      }
      console.error('Signup error:', err);
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
                placeholder="At least 8 characters"
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
            <ErrorMessage message={error} className="auth-error" />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="form-input"
                placeholder="Confirm your password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(s => !s)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-icons-outlined">
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
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
          <ErrorMessage message={tosError} className="auth-error" />

          <button
            type="submit"
            disabled={loading}
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