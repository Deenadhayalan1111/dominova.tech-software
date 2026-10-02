import { useState } from 'react';
import { useApi, Spinner, Alert, formatCurrency, formatDateTime, ConfirmModal } from './shared';
import { api } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';

export default function DeveloperProjectPool() {
  const { data, loading, error, refetch } = useApi(() => api.getProjects({ status: 'AVAILABLE_FOR_DEVELOPER', limit: 100 }));
  
  const [actionLoading, setActionLoading] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Component selection state
  const [pickedFrontend, setPickedFrontend] = useState(false);
  const [pickedBackend, setPickedBackend] = useState(false);
  const [pickedHosting, setPickedHosting] = useState(false);

  const navigate = useNavigate();

  const handleOpenAccept = (project) => {
    setSelectedProject(project);
    setPickedFrontend(project.developer_payout > 0);
    setPickedBackend(project.backend_payout > 0);
    setPickedHosting(project.hosting_payout > 0);
    setShowAcceptModal(true);
  };

  const handleConfirmAccept = async () => {
    const picked_components = [];
    if (pickedFrontend) picked_components.push('frontend');
    if (pickedBackend) picked_components.push('backend');
    if (pickedHosting) picked_components.push('hosting');

    if (picked_components.length === 0) {
      alert('You must select at least one component to pick up this project.');
      return;
    }

    setActionLoading(true);
    try {
      await api.acceptProject(selectedProject.id, { picked_components });
      alert('Project accepted successfully! You are now assigned.');
      setShowAcceptModal(false);
      navigate('/developer/my-project');
    } catch (err) {
      alert(err.message);
      refetch(); // Maybe someone else took it
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;

  const projects = data?.projects || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Available Projects Pool</h1>
          <p className="page-desc">Review and accept available projects. You can only have one active project at a time.</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏖️</div>
          <h2 style={{ margin: '0 0 8px' }}>No Available Projects</h2>
          <p className="text-muted">There are currently no new projects available to accept. Check back later.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
          {projects.map(p => {
            const potentialTotal = (p.developer_payout || 0) + (p.backend_payout || 0) + (p.hosting_payout || 0);
            return (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '18px' }}>{p.client_name}</h3>
                    <div className="badge badge-NEW" style={{ fontSize: '12px' }}>New</div>
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: '4px', fontFamily: 'monospace' }}>{p.project_id}</div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div className="text-xs text-muted font-bold" style={{ textTransform: 'uppercase', marginBottom: '4px' }}>Short Requirements</div>
                    <div className="truncate" style={{ WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', whiteSpace: 'normal', fontSize: '14px' }}>
                      {p.requirements}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="text-xs text-muted">Max Potential Payout:</span>
                      <span className="font-bold" style={{ color: 'var(--success)' }}>{formatCurrency(potentialTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span className="text-muted">Frontend:</span>
                        <span>{formatCurrency(p.developer_payout)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span className="text-muted">Backend:</span>
                        <span>{formatCurrency(p.backend_payout)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span className="text-muted">Hosting:</span>
                        <span>{formatCurrency(p.hosting_payout)}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                      <div className="text-xs text-muted">Deadline</div>
                      <div className="text-sm font-bold">{p.deadline ? formatDateTime(p.deadline).split(',')[0] : 'Not Set'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <Link to={`/developer/projects/${p.id}`} className="btn btn-secondary w-full" style={{ textAlign: 'center' }}>
                    View Details
                  </Link>
                  <button 
                    className="btn btn-primary w-full" 
                    onClick={() => handleOpenAccept(p)}
                  >
                    Accept Project
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedProject && (
        <ConfirmModal
          open={showAcceptModal}
          onClose={() => setShowAcceptModal(false)}
          title="Accept Project Components"
          message={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p className="text-sm text-muted">Please select which parts of this project you want to take on. Your total payout will be the sum of your selections.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pickedFrontend} onChange={e => setPickedFrontend(e.target.checked)} />
                  <div style={{ flex: 1 }}>Frontend Development</div>
                  <div className="font-bold" style={{ color: 'var(--success)' }}>{formatCurrency(selectedProject.developer_payout)}</div>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pickedBackend} onChange={e => setPickedBackend(e.target.checked)} />
                  <div style={{ flex: 1 }}>Backend Development</div>
                  <div className="font-bold" style={{ color: 'var(--success)' }}>{formatCurrency(selectedProject.backend_payout)}</div>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pickedHosting} onChange={e => setPickedHosting(e.target.checked)} />
                  <div style={{ flex: 1 }}>Hosting & Deployment</div>
                  <div className="font-bold" style={{ color: 'var(--success)' }}>{formatCurrency(selectedProject.hosting_payout)}</div>
                </label>
              </div>

              <div style={{ marginTop: '8px', padding: '16px', border: '1px solid var(--success)', borderRadius: '8px', background: 'rgba(74, 222, 128, 0.05)' }}>
                <div className="text-sm text-muted" style={{ marginBottom: '4px' }}>Your Potential Total:</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success)' }}>
                  {formatCurrency(
                    (pickedFrontend ? selectedProject.developer_payout : 0) +
                    (pickedBackend ? selectedProject.backend_payout : 0) +
                    (pickedHosting ? selectedProject.hosting_payout : 0)
                  )}
                </div>
              </div>
            </div>
          }
          confirmText="Confirm Acceptance"
          confirmVariant="btn-success"
          onConfirm={handleConfirmAccept}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
