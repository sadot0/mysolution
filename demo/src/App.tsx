import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import VacancyPage from './pages/VacancyPage';
import CandidatePage from './pages/CandidatePage';
import Layout from './components/Layout';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout><Dashboard /></Layout>} />
      <Route path="/vacancy/:id" element={<Layout><VacancyPage /></Layout>} />
      <Route path="/candidate/:id" element={<Layout><CandidatePage /></Layout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
