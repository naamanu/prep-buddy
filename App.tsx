import React, { useState } from 'react';
import LandingPage from '@/components/LandingPage';
import CodingApp from '@/components/CodingApp';
import SystemDesignApp from '@/components/SystemDesignApp';
import LearningApp from '@/components/LearningApp';
import MockInterviewApp from '@/components/MockInterviewApp';
import { BootSequence } from '@/components/BootSequence';
import Scanlines from '@/components/Scanlines';

type ViewState = 'landing' | 'coding' | 'system-design' | 'learning' | 'mock-interview';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('landing');

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
  };

  return (
    <>
      <Scanlines />
      {currentView === 'landing' && (
        <LandingPage onNavigate={handleNavigate} />
      )}
      {currentView === 'coding' && (
        <CodingApp onNavigateHome={() => setCurrentView('landing')} />
      )}
      {currentView === 'system-design' && (
        <SystemDesignApp onNavigateHome={() => setCurrentView('landing')} />
      )}
      {currentView === 'learning' && (
        <LearningApp onNavigateHome={() => setCurrentView('landing')} />
      )}
      {currentView === 'mock-interview' && (
        <MockInterviewApp onNavigateHome={() => setCurrentView('landing')} />
      )}
    </>
  );
};

const App: React.FC = () => {
  // Initialize booting state based on sessionStorage (lazy initialization avoids effect)
  const [booting, setBooting] = useState(() => !sessionStorage.getItem('pb_booted'));

  const handleBootComplete = () => {
    setBooting(false);
    sessionStorage.setItem('pb_booted', 'true');
  };

  if (booting) {
    return <BootSequence onComplete={handleBootComplete} />;
  }

  return <AppContent />;
};

export default App;