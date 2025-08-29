import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import './App.css';
import MissionList from './components/missions/MissionList';

function AppContent() {
  const { currentUser, logout } = useAuth();
  
  if (!currentUser) {
    return <Login />;
  }
  
  return (
    <div className="App">
      <button onClick={logout}>Logout</button>
      <MissionList/>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />  {/* This was missing! */}
    </AuthProvider>
  );
}

export default App;