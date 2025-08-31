import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import './App.css';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LogInPage';
import SignupPage from './pages/SignupPage';
import CharacterCreationPage from './pages/CharacterCreationPage';
import EditDailyMissionsPage from './pages.EditDailyMissionsPage';

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
        <Route path="/sign-up" element={<SignupPage />} />
        <Route path="/character-creation" element={<CharacterCreationPage />} />
        <Route path="/edit-daily-missions" element={<EditDailyMissionsPage />} />
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