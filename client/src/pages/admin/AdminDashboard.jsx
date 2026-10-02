import { useApi, Spinner, Alert, formatCurrency } from '../../components/shared';
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

export default function AdminDashboard() {
  const { data, loading, error } = useApi(() => api.getOverview());

  if (loading) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return null;

  const { leads, projects, finance, salesByPerson, developerStats } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Founder Dashboard</h1>
          <p className="page-desc">Complete overview of DOMINOVA operations</p>
        </div>
      </div>

      <section>
        <h2 className="section-title">Finance Overview</h2>
        <div className="stat-grid">
          <StatCard title="Total Project Value" value={formatCurrency(finance.total_project_value)} icon="💰" />
          <StatCard title="Advance Received" value={formatCurrency(finance.total_advance)} icon="📥" />
          <StatCard title="Pending Revenue" value={formatCurrency(finance.total_project_value - finance.total_advance)} icon="⏳" />
          <StatCard title="Developer Payouts" value={formatCurrency(finance.total_developer_payouts)} icon="💸" />
        </div>
      </section>

      <section>
        <h2 className="section-title">Leads & Sales</h2>
        <div className="stat-grid">
          <StatCard title="Total Leads" value={leads.total} icon="👥" link="/admin/leads" />
          <StatCard title="New Leads" value={leads.new} icon="✨" link="/admin/leads?status=NEW" />
          <StatCard title="Follow-ups Due" value={leads.followups_due_today} icon="📅" link="/admin/reports" />
          <StatCard title="Manager Escalations" value={leads.manager_review} icon="🔺" link="/admin/escalations" />
          <StatCard title="Converted" value={leads.converted} icon="🎯" link="/admin/leads?status=CONVERTED" />
        </div>
      </section>

      <section>
        <h2 className="section-title">Projects</h2>
        <div className="stat-grid">
          <StatCard title="Pending Approval" value={projects.pending_admin_approval} icon="⏳" link="/admin/projects?status=PENDING_ADMIN_APPROVAL" />
          <StatCard title="Available for Devs" value={projects.available_for_developer} icon="🆕" link="/admin/projects?status=AVAILABLE_FOR_DEVELOPER" />
          <StatCard title="In Development" value={projects.in_development} icon="⚡" link="/admin/projects" />
          <StatCard title="Pending Final Approval" value={projects.pending_final_approval} icon="✅" link="/admin/projects?status=PENDING_FINAL_APPROVAL" />
        </div>
      </section>

      <div className="dashboard-two-col">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Top Sales Performance</h3></div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Conversions</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {salesByPerson.slice(0, 5).map(s => (
                  <tr key={s.id}>
                    <td className="td-bold">{s.name}</td>
                    <td>{s.conversions}</td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(s.revenue_generated)}</td>
                  </tr>
                ))}
                {salesByPerson.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center' }} className="text-muted">No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Developer Availability</h3></div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Developer</th>
                  <th>Status</th>
                  <th>Active Project</th>
                </tr>
              </thead>
              <tbody>
                {developerStats.slice(0, 5).map(d => (
                  <tr key={d.id}>
                    <td className="td-bold">{d.name}</td>
                    <td>
                      <span className={`badge ${d.is_available ? 'badge-COMPLETED' : 'badge-TESTING'}`}>
                        {d.is_available ? 'Available' : 'Busy'}
                      </span>
                    </td>
                    <td className="truncate" style={{ maxWidth: '150px' }} title={d.active_project || 'None'}>
                      {d.active_project || 'None'}
                    </td>
                  </tr>
                ))}
                {developerStats.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center' }} className="text-muted">No developers</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
