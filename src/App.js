

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
// import Dashboard from './pages/Dashboard';
// import PrivateRoute from './components/PrivateRoute';
import './App.css';

import MissionList from './components/missions/MissionList';


function AppContent() {
  const { currentUser, logout } = useAuth();
  
  if (!currentUser) {
    return <Login />;
  }
  
  return (
    <div>
      <button onClick={logout}>Logout</button>
        <div className="App">
          <MissionList/>
        </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <MissionList/>
      </div>
    </AuthProvider>
  );
}

export default App;
