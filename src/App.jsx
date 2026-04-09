import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import WelcomeModal from './components/WelcomeModal';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import AdminDashboard from './components/AdminDashboard';
import FormBuilder from './components/FormBuilder';
import HelpFab from './components/HelpFab';
import { InstructionsModalProvider } from './contexts/InstructionsModalContext';

/** Bumped when intro content changes so users see the new modal once */
const INTRO_DISMISSED_KEY = 'de-intake-intro-dismissed-v2';

function readIntroDismissed() {
  try {
    return localStorage.getItem(INTRO_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function App() {
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => !readIntroDismissed());

  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
    try {
      localStorage.setItem(INTRO_DISMISSED_KEY, 'true');
    } catch {
      /* storage unavailable */
    }
  };

  const handleOpenWelcome = () => {
    setShowWelcomeModal(true);
  };

  return (
    <AuthProvider>
      <Router>
        <InstructionsModalProvider openInstructions={handleOpenWelcome}>
          <div className="app">
            <WelcomeModal isOpen={showWelcomeModal} onClose={handleCloseWelcome} />
            <HelpFab onClick={handleOpenWelcome} hidden={showWelcomeModal} />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/form-builder" element={<FormBuilder />} />
            </Routes>
          </div>
        </InstructionsModalProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
