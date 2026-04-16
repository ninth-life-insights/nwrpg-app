// src/components/ui/ErrorMessage.jsx
import './ErrorMessage.css';

export default function ErrorMessage({ message, onRetry, className = '' }) {
  if (!message) return null;

  return (
    <div className={`error-message-block ${className}`} role="alert">
      <span className="error-message-icon" aria-hidden="true">⚠</span>
      <span className="error-message-text">{message}</span>
      {onRetry && (
        <button className="error-message-retry" onClick={onRetry} type="button">
          Try again
        </button>
      )}
    </div>
  );
}
