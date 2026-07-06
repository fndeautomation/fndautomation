import { Routes, Route, Navigate } from 'react-router-dom';
import MyProjectsView from './components/MyProjectsView';
import ProjectDetailPage from '../projects/ProjectDetailPage';

export default function DirectorDashboard() {
  return (
    <Routes>
      <Route index element={<Navigate to="projects" replace />} />
      <Route path="projects" element={<MyProjectsView />} />
      <Route path="projects/:id" element={<ProjectDetailPage />} />
    </Routes>
  );
}
