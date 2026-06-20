// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { MissionsProvider } from './contexts/MissionsContext';
import { MissionCompletionProvider } from './contexts/MissionCompletionContext';
import { RoomsProvider } from './contexts/RoomsContext';
import { QuestsProvider } from './contexts/QuestsContext';
import { DailyMissionsProvider } from './contexts/DailyMissionsContext';
import { RoutineProvider } from './contexts/RoutineContext';
import { Navigate } from 'react-router-dom';
import OfflineIndicator from './components/OfflineIndicator';
import FeedbackButton from './components/feedback/FeedbackButton';
import './App.css';

import LandingPage from './pages/auth/LandingPage';
import LoginPage from './pages/auth/LogInPage';
import SignupPage from './pages/auth/SignupPage';
import CharacterCreationPage from './pages/character/CharacterCreationPage';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage';

import HomePage from './pages/HomePage';
import HomePageSandbox from './pages/HomePageSandbox';
import EditDailyMissionsPage from './pages/missions/EditDailyMissionsPage';
import DailyReviewPage from './pages/reviews/DailyReviewPage';
import AdventureLogPage from './pages/reviews/AdventureLogPage';
import AdventureLogDetailPage from './pages/reviews/AdventureLogDetailPage';
import MissionBankPage from './pages/missions/MissionBankPage';
import DeletedMissionsPage from './pages/missions/DeletedMissionsPage';
import QuestBank from './pages/quests/QuestBankPage';
import DeletedQuestsPage from './pages/quests/DeletedQuestsPage';
import QuestDetailView from './components/quests/QuestDetailView';
import SkillsPage from './pages/skills/SkillsPage';
import SkillDetailPage from './pages/skills/SkillDetailPage';
import BasePage from './pages/base/BasePage';
import RoomPage from './pages/base/RoomPage';
import AchievementsPage from './pages/AchievementsPage';
import SettingsPage from './pages/SettingsPage';
import EditCharacterPage from './pages/character/EditCharacterPage';
import WeeklyReviewPage from './pages/reviews/WeeklyReviewPage';
import WeeklyLogDetailPage from './pages/reviews/WeeklyLogDetailPage';
import RoutinesPage from './pages/RoutinesPage';
import RoutineBuilderPage from './pages/RoutineBuilderPage';
import RoutineWeekViewPage from './pages/RoutineWeekViewPage';
import RoutineMonthViewPage from './pages/RoutineMonthViewPage';



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
    return <Navigate to="/home" />;
  }
  
  return children;
}


function AppContent() {
  const { currentUser } = useAuth();
  return (
    <div className="App">
      <OfflineIndicator />
      <Routes>
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="/log-in" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/sign-up" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/character-creation" element={<ProtectedRoute><CharacterCreationPage /></ProtectedRoute>} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/home-sandbox" element={<ProtectedRoute><HomePageSandbox /></ProtectedRoute>} />
        <Route path="/edit-daily-missions" element={<ProtectedRoute><EditDailyMissionsPage /></ProtectedRoute>} />
        <Route path="/daily-review" element={<ProtectedRoute><DailyReviewPage /></ProtectedRoute>} />
        <Route path="/mission-bank" element={<ProtectedRoute><MissionBankPage /></ProtectedRoute>} />
        <Route path="/routines" element={<ProtectedRoute><RoutinesPage /></ProtectedRoute>} />
        <Route path="/routine-builder" element={<ProtectedRoute><RoutineBuilderPage /></ProtectedRoute>} />
        <Route path="/routine-builder/week-view" element={<ProtectedRoute><RoutineWeekViewPage /></ProtectedRoute>} />
        <Route path="/routine-builder/month-view" element={<ProtectedRoute><RoutineMonthViewPage /></ProtectedRoute>} />
        <Route path="/deleted-missions" element={<ProtectedRoute><DeletedMissionsPage /></ProtectedRoute>} />
        <Route path="/base" element={<ProtectedRoute><BasePage /></ProtectedRoute>} />
        <Route path="/room/:roomId" element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
        <Route path="/quest-bank" element={<ProtectedRoute><QuestBank /></ProtectedRoute>} />
        <Route path="/deleted-quests" element={<ProtectedRoute><DeletedQuestsPage /></ProtectedRoute>} />
        <Route path="/quests/:questId" element={<ProtectedRoute><QuestDetailView /></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute><SkillsPage /></ProtectedRoute>} />
        <Route path="/skills/:skillName" element={<ProtectedRoute><SkillDetailPage /></ProtectedRoute>} />
        <Route path="/weekly-review" element={<ProtectedRoute><WeeklyReviewPage /></ProtectedRoute>} />
        <Route path="/adventure-log" element={<ProtectedRoute><AdventureLogPage /></ProtectedRoute>} />
        <Route path="/adventure-log/weekly/:weekStart" element={<ProtectedRoute><WeeklyLogDetailPage /></ProtectedRoute>} />
        <Route path="/adventure-log/:date" element={<ProtectedRoute><AdventureLogDetailPage /></ProtectedRoute>} />
        <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/edit-character" element={<ProtectedRoute><EditCharacterPage /></ProtectedRoute>} />
      </Routes>
      {currentUser && <FeedbackButton />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <NotificationProvider>
          <MissionsProvider>
            <MissionCompletionProvider>
              <RoomsProvider>
                <QuestsProvider>
                  <DailyMissionsProvider>
                    <RoutineProvider>
                      <AppContent />
                    </RoutineProvider>
                  </DailyMissionsProvider>
                </QuestsProvider>
              </RoomsProvider>
            </MissionCompletionProvider>
          </MissionsProvider>
        </NotificationProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;