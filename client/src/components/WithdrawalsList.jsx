import { useState } from 'react';
import { useApi, Spinner, Alert, StatusBadge, formatDate, formatCurrency } from './shared';
import { api } from '../api/client';

export default function WithdrawalsList() {
  const [statusFilter, setStatusFilter] = useState('PENDING');
  
  const { data, loading, error, refetch } = useApi(() => 
    api.getAllWithdrawals({ status: statusFilter }),
    [statusFilter]
  );

  const statuses = ['PENDING', 'APPROVED', 'REJECTED'];

  const handleAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action.toLowerCase()} this withdrawal?`)) return;
    try {
      const notes = prompt(`Optional: Enter notes for this ${action.toLowerCase()} action:`);
      if (action === 'APPROVE') {
        await api.approveWithdrawal(id, { admin_notes: notes });
      } else {
        if (!notes) return alert('Notes are required for rejection.');
        await api.rejectWithdrawal(id, { admin_notes: notes });
      }
      refetch();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Withdrawal Requests</h1>
          <p className="page-desc">Review and process user withdrawal requests</p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', marginBottom: '24px' }}>
          <select className="form-control" style={{ width: '250px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? <Spinner size="lg" /> : error ? <Alert type="error">{error}</Alert> : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Requested On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.withdrawals.map(w => (
                  <tr key={w.id}>
                    <td className="text-xs text-muted">{w.withdrawal_id}</td>
                    <td>
                      <div className="font-bold">{w.user_name}</div>
                      <div className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>{w.user_role}</div>
                    </td>
                    <td className="font-bold">{formatCurrency(w.amount)}</td>
                    <td><StatusBadge status={w.status} /></td>
                    <td className="text-xs text-muted">{formatDate(w.created_at)}</td>
                    <td>
                      {w.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-success btn-sm" onClick={() => handleAction(w.id, 'APPROVE')}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleAction(w.id, 'REJECT')}>Reject</button>
                        </div>
                      ) : (
                        <span className="text-muted text-xs">Reviewed by {w.reviewed_by_name}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                      No withdrawal requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
