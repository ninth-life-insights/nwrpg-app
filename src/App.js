import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import './App.css';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LogInPage';

{/* import MissionList from './components/missions/MissionList'; */}

function AppContent() {
  const { currentUser, logout } = useAuth();
  
  if (!currentUser) {
    return <Login />;
  }
  
  return (
    <div className="App">
      <Router>
      <Routes>
      {/*<button onClick={logout}>Logout</button>*/}
      <Route path="/" element={<LandingPage />} />
        <Route path="/log-in" element={<LoginPage />} />
        {/*<LandingPage/>*/}
       {/*<MissionList/>*/}
  
       </Routes>
       </Router>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent /> 
    </AuthProvider>
  );
}

export default App;