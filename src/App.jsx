// src/App.js
import React, { Suspense, lazy } from 'react';
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
import './App.css';

// Entry-path pages stay in the main bundle — every cold start hits one of these,
// so paying for a separate chunk fetch would just add latency before first paint.
import LandingPage from './pages/auth/LandingPage';
import LoginPage from './pages/auth/LogInPage';
import SignupPage from './pages/auth/SignupPage';
import HomePage from './pages/HomePage';

// Everything else is route-split. Each chunk downloads on first navigation to
// that page and is cached for the rest of the session. The page's own skeleton
// takes over once mounted, so Suspense just needs a quiet fallback.
const CharacterCreationPage = lazy(() => import('./pages/character/CharacterCreationPage'));
const TermsPage = lazy(() => import('./pages/legal/TermsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'));
const HomePageSandbox = lazy(() => import('./pages/HomePageSandbox'));
const EditDailyMissionsPage = lazy(() => import('./pages/missions/EditDailyMissionsPage'));
const DailyReviewPage = lazy(() => import('./pages/reviews/DailyReviewPage'));
const AdventureLogPage = lazy(() => import('./pages/reviews/AdventureLogPage'));
const AdventureLogDetailPage = lazy(() => import('./pages/reviews/AdventureLogDetailPage'));
const MissionBankPage = lazy(() => import('./pages/missions/MissionBankPage'));
const DeletedMissionsPage = lazy(() => import('./pages/missions/DeletedMissionsPage'));
const QuestBank = lazy(() => import('./pages/quests/QuestBankPage'));
const DeletedQuestsPage = lazy(() => import('./pages/quests/DeletedQuestsPage'));
const QuestDetailView = lazy(() => import('./components/quests/QuestDetailView'));
const SkillsPage = lazy(() => import('./pages/skills/SkillsPage'));
const SkillDetailPage = lazy(() => import('./pages/skills/SkillDetailPage'));
const BasePage = lazy(() => import('./pages/base/BasePage'));
const RoomPage = lazy(() => import('./pages/base/RoomPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const EditCharacterPage = lazy(() => import('./pages/character/EditCharacterPage'));
const WeeklyReviewPage = lazy(() => import('./pages/reviews/WeeklyReviewPage'));
const WeeklyLogDetailPage = lazy(() => import('./pages/reviews/WeeklyLogDetailPage'));
const RoutinesPage = lazy(() => import('./pages/RoutinesPage'));
const RoutineBuilderPage = lazy(() => import('./pages/RoutineBuilderPage'));
const RoutineWeekViewPage = lazy(() => import('./pages/RoutineWeekViewPage'));
const RoutineMonthViewPage = lazy(() => import('./pages/RoutineMonthViewPage'));



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
  return (
    <div className="App">
      <OfflineIndicator />
      <Suspense fallback={null}>
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
      </Suspense>
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