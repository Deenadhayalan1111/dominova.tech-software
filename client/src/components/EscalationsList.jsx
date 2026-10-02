import { useState } from 'react';
import { useApi, Spinner, Alert, StatusBadge, formatDate, formatCurrency } from './shared';
import { api } from '../api/client';
import { Link } from 'react-router-dom';

export default function EscalationsList({ role }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  
  const { data, loading, error } = useApi(() => 
    api.getEscalations({ page, limit: 20, status: statusFilter }),
    [page, statusFilter]
  );

  const statuses = ['PENDING_MANAGER', 'IN_DISCUSSION', 'FOLLOW_UP', 'CONVERTED', 'LOST', 'CLOSED'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Escalations</h1>
          <p className="page-desc">Track leads escalated for manager review</p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ width: '250px' }}>
            <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>

        {loading ? <Spinner size="lg" /> : error ? <Alert type="error">{error}</Alert> : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Lead Info</th>
                    {role !== 'sales' && <th>Salesperson</th>}
                    {role !== 'manager' && <th>Manager</th>}
                    <th>Quoted Value</th>
                    <th>Status</th>
                    <th>Escalated On</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.escalations.map(esc => (
                    <tr key={esc.id}>
                      <td>
                        <div className="font-bold">{esc.lead_client_name}</div>
                        <div className="text-xs text-muted">{esc.lead_phone}</div>
                      </td>
                      {role !== 'sales' && <td>{esc.salesperson_name}</td>}
                      {role !== 'manager' && <td>{esc.manager_name || 'Unassigned'}</td>}
                      <td>{formatCurrency(esc.quoted_price)}</td>
                      <td><StatusBadge status={esc.status} /></td>
                      <td className="text-xs text-muted">{formatDate(esc.created_at)}</td>
                      <td>
                        <Link to={`/${role}/leads/${esc.lead_id}`} className="btn btn-ghost btn-sm">View Lead</Link>
                      </td>
                    </tr>
                  ))}
                  {data?.escalations.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                        No escalations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
