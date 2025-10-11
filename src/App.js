import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Login from './components/auth/Login';
import './App.css';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LogInPage';
import SignupPage from './pages/SignupPage';
import CharacterCreationPage from './pages/CharacterCreationPage';

import HomePage from './pages/HomePage';
import EditDailyMissionsPage from './pages/EditDailyMissionsPage';
import MissionBankPage from './pages/MissionBankPage';
import QuestBank from './pages/QuestBankPage';
import QuestDetailView from './components/quests/QuestDetailView';
import BasePage from './pages/BasePage';


function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/" />;
  }
  
  return children;
}

// Component for public routes that should redirect if already logged in
function PublicRoute({ children }) {
  const { currentUser } = useAuth();
  
  if (currentUser) {
    // Redirect authenticated users to the main app
    return <Navigate to="/home" />;
  }
  
  return children;
}


function AppContent() {
  const { currentUser, logout } = useAuth();
  
  // if (!currentUser) {
  //   return <LandingPage />;
  // }
  
  return (
    <div className="App">
      <button onClick={logout}>Logout</button>
      <Routes>
        
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="/log-in" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/sign-up" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/character-creation" element={<ProtectedRoute><CharacterCreationPage /></ProtectedRoute>} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/edit-daily-missions" element={<ProtectedRoute><EditDailyMissionsPage /></ProtectedRoute>} />
        <Route path="/mission-bank" element={<ProtectedRoute><MissionBankPage /></ProtectedRoute>} />
        <Route path="/base" element={<ProtectedRoute><BasePage /></ProtectedRoute>} />
        <Route path="/quest-bank" element={<ProtectedRoute><QuestBank /></ProtectedRoute>} />
        <Route path="/quests/:questId" element={<ProtectedRoute><QuestDetailView /></ProtectedRoute>} />
        {/*<LandingPage/>*/}
        {/*<MissionList/>*/}
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent /> 
      </Router>
    </AuthProvider>
  );
}

export default App;