import { useState } from 'react';
import { api } from '../../api/client';
import { Spinner, Alert, formatCurrency } from '../../components/shared';

export default function ManualCreditModal({ users, onSuccess, onCancel }) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  // To handle the confirmation step
  const [showConfirm, setShowConfirm] = useState(false);

  const eligibleUsers = users.filter(u => u.is_active === 1 && u.role !== 'admin');
  const selectedUser = eligibleUsers.find(u => u.id === Number(selectedUserId));

  const handleConfirm = () => {
    setError(null);
    if (!selectedUserId) {
      setError('Please select an employee.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than ₹0.');
      return;
    }
    if (!reason || reason.trim() === '') {
      setError('Please enter a reason.');
      return;
    }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.request('POST', '/api/wallets/credit', {
        user_id: selectedUser.id,
        amount: parseFloat(amount),
        description: reason,
        note: note,
        type: 'MANUAL_CREDIT'
      });
      setSuccessMsg(`₹${formatCurrency(parseFloat(amount)).replace('₹', '')} added successfully to ${selectedUser.name}'s wallet.`);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to add wallet amount');
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.8)', zIndex: 1000, 
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{ background: 'var(--bg-dark-base)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '500px', position: 'relative' }}>
        {!successMsg && <button className="btn btn-ghost" onClick={onCancel} style={{ position: 'absolute', top: '16px', right: '16px' }} disabled={loading}>✕</button>}
        
        <h2 className="section-title" style={{ marginTop: 0 }}>Add Wallet Amount</h2>
        
        {successMsg ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Alert type="success">{successMsg}</Alert>
          </div>
        ) : showConfirm ? (
          <div>
            <p style={{ fontSize: '1.2rem', marginBottom: '24px', textAlign: 'center' }}>
              Add {formatCurrency(parseFloat(amount))} to {selectedUser.name}'s wallet?
            </p>
            <div style={{ background: 'var(--bg-dark-elevated)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
              <div style={{ marginBottom: '8px' }}><strong>Reason:</strong> {reason}</div>
              <div className="text-muted text-sm">This action will create a manual credit transaction and cannot be easily undone.</div>
            </div>
            {error && <div style={{ marginBottom: '16px' }}><Alert type="error">{error}</Alert></div>}
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={loading}>Back</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? <Spinner size="sm" /> : 'Confirm & Add to Wallet'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-muted" style={{ marginBottom: '24px' }}>Manually credit an employee's wallet. Only eligible employees are listed.</p>
            
            {error && <div style={{ marginBottom: '16px' }}><Alert type="error">{error}</Alert></div>}
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Employee</label>
              <select 
                className="form-control" 
                value={selectedUserId} 
                onChange={e => setSelectedUserId(e.target.value)}
              >
                <option value="">Select Employee...</option>
                {eligibleUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}{u.domain ? ` - ${u.domain}` : ''})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Amount (₹)</label>
              <input 
                type="number" 
                className="form-control" 
                placeholder="e.g. 2000"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>Reason / Description</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Performance bonus for September"
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>Note (Optional)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Approved by founder"
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={200}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirm}>Add to Wallet</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
