// Login.js
import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    try {
      setError('');
      setLoading(true);
      
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch (error) {
      setError('Failed to ' + (isLogin ? 'log in' : 'create account'));
      console.error(error);
    }
    
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
      
      {error && (
        <div style={{ 
          color: 'red', 
          padding: '10px', 
          border: '1px solid red', 
          borderRadius: '4px',
          marginBottom: '15px' 
        }}>
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginTop: '5px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginTop: '5px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Loading...' : (isLogin ? 'Login' : 'Sign Up')}
        </button>
      </form>
      
      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <button 
          onClick={() => setIsLogin(!isLogin)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#007bff',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {isLogin ? 'Need an account? Sign up' : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}