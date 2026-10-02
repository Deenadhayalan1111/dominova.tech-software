import { useApi, Spinner, Alert } from './shared';
import { api } from '../api/client';
import ProjectDetail from './ProjectDetail';
import { useParams, Navigate } from 'react-router-dom';

export default function DeveloperActiveProject() {
  const { data, loading, error } = useApi(() => api.getProjects({ limit: 10 }));

  if (loading) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;

  // Find the active project
  const activeStatuses = ['ASSIGNED', 'IN_DEVELOPMENT', 'TESTING', 'SUBMITTED', 'PENDING_FINAL_APPROVAL', 'REVISION_REQUIRED'];
  const activeProject = data?.projects?.find(p => activeStatuses.includes(p.status));

  if (!activeProject) {
    return (
      <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>☕</div>
        <h2 style={{ margin: '0 0 8px' }}>No Active Project</h2>
        <p className="text-muted" style={{ marginBottom: '24px' }}>You don't have an active project assigned to you right now.</p>
        <a href="/developer/projects" className="btn btn-primary">Browse Available Projects</a>
      </div>
    );
  }

  // Render the generic ProjectDetail but via the router or directly.
  // Actually, ProjectDetail expects `useParams().id`. Let's just redirect to it!
  return <Navigate to={`/developer/projects/${activeProject.id}`} replace />;
}
