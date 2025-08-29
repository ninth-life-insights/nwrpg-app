

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import { AuthProvider } from './contexts/AuthContext';
// import Login from './pages/Login';
// import Dashboard from './pages/Dashboard';
// import PrivateRoute from './components/PrivateRoute';
import './App.css';

import MissionList from './components/missions/MissionList';

function App() {
  return (
    <div className="App">
      <MissionList/>
    </div>
  );
}

export default App;
