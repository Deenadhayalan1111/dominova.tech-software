import { useState, useCallback } from 'react';
import { useApi, useForm, Spinner, Alert, StatusBadge, formatDate, formatCurrency, SearchBar, Pagination } from './shared';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NewLeadModal from './NewLeadModal';

function Toast({ message, onDone }) {
  return (
    <div
      onClick={onDone}
      style={{
        position: 'fixed', bottom: '28px', right: '28px', zIndex: 2000,
        background: 'var(--bg-dark-base)',
        border: '1px solid var(--brand-primary)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.25s ease',
        cursor: 'pointer',
        maxWidth: '360px',
      }}
    >
      <span style={{ fontSize: '20px' }}>✅</span>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-on-dark)' }}>Lead Created!</div>
        <div style={{ fontSize: '12px', color: 'var(--text-on-dark-muted)' }}>{message}</div>
      </div>
    </div>
  );
}

export default function LeadsList({ role = 'admin', defaultStatusFilter = '' }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);
  const [showNewLead, setShowNewLead] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading, error } = useApi(
    () => api.getLeads({ page, limit: 20, search, status: statusFilter }),
    [page, search, statusFilter, refreshKey]
  );

  const statuses = ['NEW', 'ASSIGNED', 'CONTACTED', 'INTERESTED', 'FOLLOW_UP', 'MANAGER_REVIEW', 'CONVERTED', 'LOST'];

  const handleLeadCreated = (lead) => {
    setRefreshKey(k => k + 1);
    setToast(`${lead?.lead_id || 'Lead'} created for ${lead?.client_name || 'client'}`);
    setTimeout(() => setToast(null), 4000);
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        alert(`CSV/Excel import for "${file.name}" — bulk import endpoint to be wired here.\n\nThe file has been selected. Contact your system administrator to process the bulk import.`);
      }
    };
    input.click();
  };

  const canCreate = role === 'admin' || role === 'sales';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {role === 'admin' ? 'All Leads' : defaultStatusFilter === 'FOLLOW_UP' ? 'My Follow-ups' : 'My Leads'}
          </h1>
          <p className="page-desc">
            {defaultStatusFilter === 'FOLLOW_UP' ? 'Leads scheduled for follow-up' : 'Manage and track your sales pipeline'}
          </p>
        </div>
        {canCreate && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" onClick={handleImportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📥</span> Import CSV
            </button>
            <button className="btn btn-primary" onClick={() => setShowNewLead(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> New Lead
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by name, phone, org, lead ID..."
          filters={
            <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          }
        />

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <Alert type="error">{error}</Alert>
        ) : (
          <>
            <div className="table-wrapper" style={{ marginTop: '24px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Lead ID</th>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Status</th>
                    {role === 'admin' && <th>Assigned To</th>}
                    <th>Quoted</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.leads.map(lead => (
                    <tr key={lead.id}>
                      <td className="td-muted" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{lead.lead_id}</td>
                      <td>
                        <div className="font-bold">{lead.client_name}</div>
                        {lead.org_name && <div className="text-xs text-muted">{lead.org_name}</div>}
                      </td>
                      <td>
                        <div>{lead.phone}</div>
                        {lead.email && <div className="text-xs text-muted" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</div>}
                      </td>
                      <td><StatusBadge status={lead.status} /></td>
                      {role === 'admin' && (
                        <td>{lead.assigned_to_name || <span className="text-muted">Unassigned</span>}</td>
                      )}
                      <td>{formatCurrency(lead.quoted_amount)}</td>
                      <td className="text-xs text-muted">{formatDate(lead.created_at)}</td>
                      <td>
                        <Link to={`/${role}/leads/${lead.id}`} className="btn btn-ghost btn-sm">View →</Link>
                      </td>
                    </tr>
                  ))}
                  {data?.leads.length === 0 && (
                    <tr>
                      <td colSpan={role === 'admin' ? 8 : 7} style={{ textAlign: 'center', padding: '56px 24px' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>No leads found</div>
                        <div className="text-muted text-sm">
                          {search ? 'Try different search terms.' : canCreate ? 'Click "+ New Lead" to create your first lead.' : 'No leads have been assigned to you yet.'}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {data && data.total > data.limit && (
              <Pagination page={page} total={data.total} limit={data.limit} onChange={setPage} />
            )}

            {data && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>
                Showing {data.leads.length} of {data.total} leads
              </div>
            )}
          </>
        )}
      </div>

      {/* New Lead Modal */}
      <NewLeadModal
        open={showNewLead}
        onClose={() => setShowNewLead(false)}
        onCreated={handleLeadCreated}
        userRole={user?.role}
        userId={user?.id}
      />

      {/* Success Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
