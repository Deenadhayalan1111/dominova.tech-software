import { useApi, Spinner, Alert } from '../../components/shared';
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

export default function SalesDashboard() {
  const { data, loading, error } = useApi(() => api.getLeadStats());

  if (loading) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return null;

  const stats = data.stats;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Sales Dashboard</h1>
          <p className="page-desc">Manage your leads and conversions</p>
        </div>
        <div>
          <Link to="/sales/leads" className="btn btn-primary">
            + New Lead
          </Link>
        </div>
      </div>

      <section>
        <h2 className="section-title">My Performance</h2>
        <div className="stat-grid">
          <StatCard title="Total Leads" value={stats.total} icon="🎯" link="/sales/leads" />
          <StatCard title="Converted" value={stats.converted} icon="🏆" link="/sales/projects" />
          <StatCard title="Interested" value={stats.interested} icon="🔥" link="/sales/leads?status=INTERESTED" />
          <StatCard title="Lost" value={stats.lost} icon="❌" />
        </div>
      </section>

      <section>
        <h2 className="section-title">Action Required</h2>
        <div className="stat-grid">
          <StatCard title="New Assigned" value={stats.assigned} icon="✨" link="/sales/leads?status=ASSIGNED" />
          <StatCard title="Follow-ups Due Today" value={stats.followups_due_today} icon="📅" link="/sales/followups" />
          <StatCard title="Manager Escalations" value={stats.manager_review} icon="🔺" link="/sales/escalations" />
        </div>
      </section>
    </div>
  );
}
