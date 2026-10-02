import { useApi, Spinner, Alert, formatCurrency } from './shared';
import { api } from '../api/client';

export default function WalletsList() {
  const { data, loading, error } = useApi(() => api.getAllWallets());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Wallets</h1>
          <p className="page-desc">Overview of all user wallets and balances</p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        {loading ? <Spinner size="lg" /> : error ? <Alert type="error">{error}</Alert> : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Available Balance</th>
                  <th>Pending Withdrawal</th>
                  <th>Total Withdrawn</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.wallets.map(w => (
                  <tr key={w.id}>
                    <td>
                      <div className="font-bold">{w.user_name}</div>
                      <div className="text-xs text-muted">{w.user_email}</div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{w.user_role}</td>
                    <td className="font-bold" style={{ color: 'var(--success)' }}>
                      {formatCurrency(w.available_balance)}
                    </td>
                    <td style={{ color: 'var(--warning)' }}>
                      {formatCurrency(w.pending_withdrawal)}
                    </td>
                    <td>{formatCurrency(w.total_withdrawn)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => alert('View details to be implemented')}>Details</button>
                    </td>
                  </tr>
                ))}
                {data?.wallets.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                      No active wallets found.
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
