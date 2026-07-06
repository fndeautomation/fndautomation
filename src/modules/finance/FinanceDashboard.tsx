import { Routes, Route, Navigate } from 'react-router-dom';
import AllProjectsView from './components/AllProjectsView';
import AllClaimsView from './components/AllClaimsView';
import ProjectDetailPage from '../projects/ProjectDetailPage';

export default function FinanceDashboard() {
  return (
    <Routes>
      <Route index element={<Navigate to="projects" replace />} />
      <Route path="projects" element={<AllProjectsView />} />
      <Route path="projects/:id" element={<ProjectDetailPage />} />
      <Route path="claims" element={<AllClaimsView />} />
    </Routes>
  );
}
