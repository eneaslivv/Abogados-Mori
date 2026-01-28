
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { Contracts } from './pages/Contracts';
import { Documents } from './pages/Documents'; // Import Documents
import { Tasks } from './pages/Tasks';
import { CalendarPage } from './pages/CalendarPage';
import { Team } from './pages/Team'; // Import Team
import { Support } from './pages/Support'; // Import Support
import { Settings } from './pages/Settings';
import { db } from './services/mockDb';

export default function App() {
  
  useEffect(() => {
    db.initialize();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="documents" element={<Documents />} /> {/* New Route */}
          <Route path="tasks" element={<Tasks />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="team" element={<Team />} /> {/* Updated Route */}
          <Route path="settings" element={<Settings />} />
          <Route path="support" element={<Support />} /> {/* New Route */}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
