import { useState } from 'react';
import { useApi, Spinner, Alert, StatusBadge, formatCurrency, Avatar, ConfirmModal } from '../../components/shared';
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

export default function ManagerDashboard() {
  const { data: escData, loading: escLoading, error: escError, refetch } = useApi(() => api.getEscalations({}));
  const { data: statsData, loading: statsLoading, error: statsError } = useApi(() => api.getOverview());

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [resolveStatus, setResolveStatus] = useState('IN_DISCUSSION');
  const [managerNotes, setManagerNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  if (escLoading || statsLoading) return <Spinner size="lg" />;
  if (escError || statsError) return <Alert type="error">{escError || statsError}</Alert>;
  if (!escData || !statsData) return null;

  const escalations = escData.escalations || [];
  const pendingCount = escalations.filter(e => e.status === 'PENDING_MANAGER').length;
  const inDiscussionCount = escalations.filter(e => e.status === 'IN_DISCUSSION').length;
  const convertedCount = escalations.filter(e => e.status === 'CONVERTED').length;

  const activeEscalations = escalations.filter(e => !['CONVERTED', 'LOST', 'CLOSED'].includes(e.status));

  const handleResolve = async () => {
    setActionLoading(true);
    try {
      await api.resolveEscalation(selectedEscalation.id, {
        status: resolveStatus,
        manager_notes: managerNotes
      });
      setShowResolveModal(false);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Manager Dashboard</h1>
          <p className="page-desc">Review and close escalated leads</p>
        </div>
      </div>

      <section>
        <h2 className="section-title">Escalations Overview</h2>
        <div className="stat-grid">
          <StatCard title="Pending Review" value={pendingCount} icon="⚠️" />
          <StatCard title="In Discussion" value={inDiscussionCount} icon="💬" />
          <StatCard title="Converted" value={convertedCount} icon="🎯" />
          <StatCard title="Total Escalated" value={escalations.length} icon="🔺" />
        </div>
      </section>
      
      <section>
        <h2 className="section-title">Active Escalations</h2>
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Salesperson</th>
                  <th>Quoted</th>
                  <th>Reason for Review</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeEscalations.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div className="font-bold">{e.client_name}</div>
                      <div className="text-xs text-muted">{e.lead_id}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar name={e.salesperson_name} size={24} />
                        <span>{e.salesperson_name}</span>
                      </div>
                    </td>
                    <td>{formatCurrency(e.quoted_price)}</td>
                    <td style={{ maxWidth: '300px' }}>
                      <div className="truncate" title={e.reason}>{e.reason}</div>
                      {e.manager_notes && <div className="text-xs text-muted truncate" title={e.manager_notes}>Mgr: {e.manager_notes}</div>}
                    </td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link to={`/manager/leads/${e.lead_id_pk}`} className="btn btn-ghost btn-sm">View Lead</Link>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setSelectedEscalation(e);
                          setResolveStatus(e.status);
                          setManagerNotes(e.manager_notes || '');
                          setShowResolveModal(true);
                        }}>Update</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {activeEscalations.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                      No active escalations.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedEscalation && (
        <ConfirmModal
          open={showResolveModal} onClose={() => setShowResolveModal(false)}
          title="Update Manager Review"
          message={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Review Status</label>
                <select className="form-control" value={resolveStatus} onChange={e => setResolveStatus(e.target.value)}>
                  <option value="IN_DISCUSSION">In Discussion (Client Contacted)</option>
                  <option value="FOLLOW_UP">Schedule Follow-up</option>
                  <option value="CLOSED">Send Back to Sales (Closed)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Manager Notes</label>
                <textarea className="form-control" placeholder="Summarize your discussion with the client..." value={managerNotes} onChange={e => setManagerNotes(e.target.value)} />
              </div>
              <Alert type="info">Note: To convert this to a project, tell the Salesperson to "Push to Admin" after you confirm.</Alert>
            </div>
          }
          confirmText="Save Update" confirmVariant="btn-primary"
          onConfirm={handleResolve}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
