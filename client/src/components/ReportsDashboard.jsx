import { useApi, Spinner, Alert, formatCurrency, formatDate } from './shared';
import { api } from '../api/client';

function StatCard({ label, value, color, icon }) {
  return (
    <div className="card stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '28px' }}>{icon}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function ReportsDashboard() {
  const { data, loading, error } = useApi(() => api.getOverview());

  if (loading) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;

  const { leads = {}, projects = {}, finance = {}, salesByPerson = [], developerStats = [] } = data || {};

  const conversionRate = leads.total > 0
    ? ((leads.converted / leads.total) * 100).toFixed(1)
    : '0.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Reports</h1>
          <p className="page-desc">Real-time overview of all operations across the platform</p>
        </div>
      </div>

      {/* Finance KPIs */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Finance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard icon="💰" label="Total Project Value" value={formatCurrency(finance.total_project_value)} color="var(--brand-primary)" />
          <StatCard icon="🏦" label="Total Advance Collected" value={formatCurrency(finance.total_advance)} />
          <StatCard icon="💸" label="Developer Payouts" value={formatCurrency(finance.total_developer_payouts)} />
          <StatCard icon="🎯" label="Sales Commissions Paid" value={formatCurrency(finance.total_sales_commissions)} />
          <StatCard icon="⏳" label="Pending Withdrawals" value={formatCurrency(finance.pending_withdrawal_amount)} color="var(--warning)" />
        </div>
      </div>

      {/* Leads KPIs */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Leads Pipeline</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <StatCard icon="📋" label="Total Leads" value={leads.total} />
          <StatCard icon="🆕" label="New / Unassigned" value={leads.new} />
          <StatCard icon="📅" label="Follow-ups Due Today" value={leads.followups_due_today} color="var(--warning)" />
          <StatCard icon="⚠️" label="Overdue Follow-ups" value={leads.followups_overdue} color="var(--danger)" />
          <StatCard icon="✅" label="Converted" value={leads.converted} color="var(--success)" />
          <StatCard icon="📈" label="Conversion Rate" value={`${conversionRate}%`} color="var(--brand-primary)" />
        </div>
      </div>

      {/* Projects KPIs */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Projects</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <StatCard icon="📁" label="Total Projects" value={projects.total} />
          <StatCard icon="🔎" label="Pending Approval" value={projects.pending_admin_approval} color="var(--warning)" />
          <StatCard icon="🆕" label="Available for Developers" value={projects.available_for_developer} />
          <StatCard icon="⚡" label="In Development" value={projects.in_development} color="var(--info)" />
          <StatCard icon="🏁" label="Pending Final Approval" value={projects.pending_final_approval} color="var(--warning)" />
          <StatCard icon="🔄" label="Revision Required" value={projects.revision_required} color="var(--danger)" />
          <StatCard icon="✅" label="Completed" value={projects.completed} color="var(--success)" />
        </div>
      </div>

      {/* Sales Team Performance */}
      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '20px' }}>Sales Team Performance</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Active Leads</th>
                <th>Follow-ups</th>
                <th>Escalations</th>
                <th>Conversions</th>
                <th>Revenue Generated</th>
              </tr>
            </thead>
            <tbody>
              {salesByPerson.map(s => (
                <tr key={s.id}>
                  <td className="font-bold">{s.name}</td>
                  <td>{s.active_leads}</td>
                  <td style={{ color: s.follow_ups > 0 ? 'var(--warning)' : 'inherit' }}>{s.follow_ups}</td>
                  <td>{s.escalations}</td>
                  <td style={{ color: s.conversions > 0 ? 'var(--success)' : 'inherit', fontWeight: s.conversions > 0 ? 700 : 400 }}>{s.conversions}</td>
                  <td style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{formatCurrency(s.revenue_generated)}</td>
                </tr>
              ))}
              {salesByPerson.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">No sales team data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Developer Stats */}
      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '20px' }}>Developer Performance</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Developer</th>
                <th>Availability</th>
                <th>Active Project</th>
                <th>Completed Projects</th>
                <th>Total Earned</th>
                <th>Wallet Balance</th>
              </tr>
            </thead>
            <tbody>
              {developerStats.map(d => (
                <tr key={d.id}>
                  <td className="font-bold">{d.name}</td>
                  <td>
                    <span className={`badge ${d.is_available ? 'badge-ACTIVE' : 'badge-ASSIGNED'}`}>
                      {d.is_available ? 'Available' : 'Busy'}
                    </span>
                  </td>
                  <td className="text-muted text-xs">{d.active_project || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{d.completed_projects}</td>
                  <td style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{formatCurrency(d.total_earned)}</td>
                  <td>{formatCurrency(d.available_balance)}</td>
                </tr>
              ))}
              {developerStats.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">No developer data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
