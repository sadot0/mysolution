import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './utils/auth-store';
import LoginPage from './pages/LoginPage';
import VacanciesPage from './pages/VacanciesPage';
import VacancyPage from './pages/VacancyPage';
import CandidatePage from './pages/CandidatePage';
import CandidatesGlobalPage from './pages/CandidatesGlobalPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import ApplyPage from './pages/ApplyPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import AdminPage from './pages/AdminPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/vacancies"
        element={<PrivateRoute><VacanciesPage /></PrivateRoute>}
      />
      <Route
        path="/vacancies/:id"
        element={<PrivateRoute><VacancyPage /></PrivateRoute>}
      />
      <Route
        path="/candidates/:id"
        element={<PrivateRoute><CandidatePage /></PrivateRoute>}
      />
      <Route
        path="/analytics"
        element={<PrivateRoute><AnalyticsPage /></PrivateRoute>}
      />
      <Route
        path="/candidates"
        element={<PrivateRoute><CandidatesGlobalPage /></PrivateRoute>}
      />
      <Route
        path="/settings"
        element={<PrivateRoute><SettingsPage /></PrivateRoute>}
      />
      <Route
        path="/admin"
        element={<PrivateRoute><AdminPage /></PrivateRoute>}
      />
      <Route path="/apply/:vacancyId" element={<ApplyPage />} />
      <Route path="/" element={<Navigate to="/vacancies" replace />} />
      <Route path="*" element={<Navigate to="/vacancies" replace />} />
    </Routes>
  );
}
