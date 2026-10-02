import { useApi, Spinner, Alert, formatCurrency, formatDateTime } from '../../components/shared';
import { api } from '../../api/client';
import { Link } from 'react-router-dom';

function StatCard({ title, value, icon, link }) {
  const content = (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-value">{value}</div>
        <div className="stat-icon" style={{ background: 'var(--bg-elevated)', color: 'var(--brand-primary-light)' }}>
          {icon}
        </div>
      </div>
      <div className="stat-label">{title}</div>
    </div>
  );
  
  return link ? <Link to={link} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

export default function DeveloperDashboard() {
  const { data: statsData, loading: statsLoading, error: statsError } = useApi(() => api.getProjectStats());
  const { data: walletData, loading: walletLoading, error: walletError } = useApi(() => api.getMyWallet());
  const { data: projectsData, loading: projectsLoading } = useApi(() => api.getProjects({ limit: 10 }));

  if (statsLoading || walletLoading || projectsLoading) return <Spinner size="lg" />;
  if (statsError || walletError) return <Alert type="error">{statsError || walletError}</Alert>;
  if (!statsData || !walletData) return null;

  const activeStatuses = ['ASSIGNED', 'IN_DEVELOPMENT', 'TESTING', 'SUBMITTED', 'PENDING_FINAL_APPROVAL', 'REVISION_REQUIRED'];
  const activeProject = projectsData?.projects?.find(p => activeStatuses.includes(p.status));

  let activeTotalPayout = 0;
  if (activeProject) {
    if (activeProject.picked_components) {
      const picked = activeProject.picked_components.split(',');
      if (picked.includes('frontend')) activeTotalPayout += (activeProject.developer_payout || 0);
      if (picked.includes('backend')) activeTotalPayout += (activeProject.backend_payout || 0);
      if (picked.includes('hosting')) activeTotalPayout += (activeProject.hosting_payout || 0);
    } else {
      activeTotalPayout = activeProject.developer_payout || 0;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Developer Dashboard</h1>
          <p className="page-desc">Manage your projects and earnings</p>
        </div>
      </div>

      {activeProject ? (
        <div className="card" style={{ border: '1px solid var(--brand-primary)' }}>
          <div style={{ background: 'var(--brand-primary-dark)', padding: '16px 24px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'var(--text-on-dark)', fontSize: '18px' }}>Your Active Project</h2>
            <div className="badge badge-ASSIGNED" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>{activeProject.status.replace(/_/g, ' ')}</div>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '20px' }}>{activeProject.client_name}</h3>
                <div className="text-muted" style={{ fontFamily: 'monospace' }}>{activeProject.project_id}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-xs text-muted">Deadline</div>
                <div className="font-bold">{activeProject.deadline ? formatDateTime(activeProject.deadline).split(',')[0] : 'Not Set'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: '16px', borderRadius: '8px' }}>
              <div>
                <div className="text-xs text-muted">Your Total Payout (Based on selection)</div>
                <div className="font-bold" style={{ fontSize: '18px', color: 'var(--success)' }}>{formatCurrency(activeTotalPayout)}</div>
              </div>
              <Link to="/developer/my-project" className="btn btn-primary">Open Workspace →</Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚀</div>
          <h3 style={{ margin: '0 0 8px' }}>Ready for Work!</h3>
          <p className="text-muted" style={{ marginBottom: '16px' }}>You have 0 active projects. You can accept a new one.</p>
          <Link to="/developer/projects" className="btn btn-primary">Browse Available Projects</Link>
        </div>
      )}

      <section>
        <h2 className="section-title">My Projects</h2>
        <div className="stat-grid">
          <StatCard title="Available Projects" value={statsData.available_for_developer} icon="🆕" link="/developer/projects" />
          <StatCard title="In Development" value={statsData.in_development} icon="⚡" link="/developer/my-project" />
          <StatCard title="Revisions Required" value={statsData.revision_required} icon="⚠️" link="/developer/my-project" />
          <StatCard title="Completed" value={statsData.completed} icon="✅" link="/developer/completed" />
        </div>
      </section>

      <section>
        <h2 className="section-title">My Earnings</h2>
        <div className="stat-grid">
          <StatCard title="Available Balance" value={formatCurrency(walletData.wallet.available_balance)} icon="💰" link="/developer/wallet" />
          <StatCard title="Total Earned" value={formatCurrency(walletData.wallet.total_earned)} icon="📈" link="/developer/wallet" />
          <StatCard title="Total Withdrawn" value={formatCurrency(walletData.wallet.total_withdrawn)} icon="💸" link="/developer/wallet" />
        </div>
      </section>
    </div>
  );
}
