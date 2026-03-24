import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './utils/auth-store';

// Critical path — direct imports
import LoginPage from './pages/LoginPage';
import VacanciesPage from './pages/VacanciesPage';
import DashboardPage from './pages/DashboardPage';

// Lazy load everything else
const VacancyPage = React.lazy(() => import('./pages/VacancyPage'));
const CandidatePage = React.lazy(() => import('./pages/CandidatePage'));
const CandidatesGlobalPage = React.lazy(() => import('./pages/CandidatesGlobalPage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const SupportPage = React.lazy(() => import('./pages/SupportPage'));
const InterviewsPage = React.lazy(() => import('./pages/InterviewsPage'));
const TalentPoolPage = React.lazy(() => import('./pages/TalentPoolPage'));
const AssessmentsPage = React.lazy(() => import('./pages/AssessmentsPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const TeamPage = React.lazy(() => import('./pages/TeamPage'));
const CRMPage = React.lazy(() => import('./pages/CRMPage'));
const LMSPage = React.lazy(() => import('./pages/LMSPage'));
const ApplyPage = React.lazy(() => import('./pages/ApplyPage'));
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-orange-500 rounded-full animate-spin" />
      </div>
    }>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/dashboard"
          element={<PrivateRoute><DashboardPage /></PrivateRoute>}
        />
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
        <Route
          path="/crm"
          element={<PrivateRoute><CRMPage /></PrivateRoute>}
        />
        <Route
          path="/lms"
          element={<PrivateRoute><LMSPage /></PrivateRoute>}
        />
        <Route
          path="/assessments"
          element={<PrivateRoute><AssessmentsPage /></PrivateRoute>}
        />
        <Route
          path="/interviews"
          element={<PrivateRoute><InterviewsPage /></PrivateRoute>}
        />
        <Route
          path="/reports"
          element={<PrivateRoute><ReportsPage /></PrivateRoute>}
        />
        <Route
          path="/talent-pool"
          element={<PrivateRoute><TalentPoolPage /></PrivateRoute>}
        />
        <Route
          path="/team"
          element={<PrivateRoute><TeamPage /></PrivateRoute>}
        />
        <Route
          path="/support"
          element={<PrivateRoute><SupportPage /></PrivateRoute>}
        />
        <Route path="/apply/:vacancyId" element={<ApplyPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
