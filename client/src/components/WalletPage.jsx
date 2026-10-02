import { useState } from 'react';
import { useApi, Spinner, Alert, formatCurrency, formatDateTime, ConfirmModal } from './shared';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function WalletPage({ userId }) {
  const { user } = useAuth();
  const isSelf = !userId || userId === user.id;
  const targetId = userId || user.id;

  const { data, loading, error, refetch } = useApi(() => 
    isSelf ? api.getMyWallet() : api.getWallet(targetId)
  , [targetId, isSelf]);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  if (loading) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return null;

  const { wallet, transactions } = data;

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return alert('Invalid amount');
    setActionLoading(true);
    try {
      await api.requestWithdrawal({ amount: withdrawAmount, notes: withdrawNotes });
      alert('Withdrawal requested successfully');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawNotes('');
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">{isSelf ? 'My Wallet' : `${wallet.user_name}'s Wallet`}</h1>
          <p className="page-desc">Track earnings and withdrawals</p>
        </div>
        {isSelf && user.role !== 'admin' && (
          <button 
            className="btn btn-primary" 
            onClick={() => setShowWithdrawModal(true)}
            disabled={wallet.available_balance <= 0 || wallet.pending_withdrawal > 0}
          >
            Request Withdrawal
          </button>
        )}
      </div>

      {wallet.pending_withdrawal > 0 && (
        <Alert type="warning">You have a pending withdrawal request of {formatCurrency(wallet.pending_withdrawal)}.</Alert>
      )}

      <div className="wallet-card">
        <div className="wallet-label">Available Balance</div>
        <div className="wallet-balance">{formatCurrency(wallet.available_balance)}</div>
        
        <div className="wallet-meta">
          <div className="wallet-meta-item">
            <span className="wallet-meta-label">Total Earned</span>
            <span className="wallet-meta-value" style={{ color: 'var(--success)' }}>{formatCurrency(wallet.total_earned)}</span>
          </div>
          <div className="wallet-meta-item">
            <span className="wallet-meta-label">Total Withdrawn</span>
            <span className="wallet-meta-value">{formatCurrency(wallet.total_withdrawn)}</span>
          </div>
          <div className="wallet-meta-item">
            <span className="wallet-meta-label">Pending Approval</span>
            <span className="wallet-meta-value" style={{ color: 'var(--warning)' }}>{formatCurrency(wallet.pending_withdrawal)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Transaction History</h2>
        {transactions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {transactions.map(txn => (
              <div key={txn.id} className="txn-item">
                <div className="txn-left">
                  <div className={`txn-icon ${txn.direction === 'CREDIT' ? 'credit' : 'debit'}`}>
                    {txn.direction === 'CREDIT' ? '↓' : '↑'}
                  </div>
                  <div>
                    <div className="txn-desc">{txn.description}</div>
                    {txn.note && <div className="text-muted text-sm" style={{ marginTop: '4px' }}>{txn.note}</div>}
                    <div className="txn-date">{formatDateTime(txn.created_at)} {txn.project_id && `• Project ${txn.project_id}`}</div>
                  </div>
                </div>
                <div className={`txn-amount ${txn.direction === 'CREDIT' ? 'credit' : 'debit'}`}>
                  {txn.direction === 'CREDIT' ? '+' : '-'}{formatCurrency(txn.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-center" style={{ padding: '20px' }}>No transactions found.</p>
        )}
      </div>

      <ConfirmModal
        open={showWithdrawModal} onClose={() => setShowWithdrawModal(false)}
        title="Request Withdrawal"
        message={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Alert type="info">Your available balance is {formatCurrency(wallet.available_balance)}.</Alert>
            <div className="form-group">
              <label>Withdrawal Amount (₹)</label>
              <input 
                type="number" className="form-control" 
                max={wallet.available_balance} 
                value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>Notes / Bank Details (Optional)</label>
              <textarea className="form-control" value={withdrawNotes} onChange={e => setWithdrawNotes(e.target.value)} />
            </div>
          </div>
        }
        confirmText="Submit Request" confirmVariant="btn-primary"
        onConfirm={handleWithdraw} loading={actionLoading}
      />
    </div>
  );
}
