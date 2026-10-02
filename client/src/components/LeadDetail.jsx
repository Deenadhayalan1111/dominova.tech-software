import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi, Spinner, Alert, StatusBadge, formatCurrency, formatDateTime, ExternalLink, ConfirmModal } from './shared';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function Toast({ message, type = 'success', onDone }) {
  return (
    <div
      onClick={onDone}
      style={{
        position: 'fixed', bottom: '28px', right: '28px', zIndex: 2000,
        background: 'var(--bg-dark-base)',
        border: `1px solid ${type === 'success' ? 'var(--success)' : 'var(--warning)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.25s ease',
        cursor: 'pointer',
        maxWidth: '360px',
      }}
    >
      <span style={{ fontSize: '20px' }}>{type === 'success' ? '✅' : '⚠️'}</span>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-on-dark)' }}>
          {type === 'success' ? 'Success' : 'Notice'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-on-dark-muted)' }}>{message}</div>
      </div>
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(() => api.getLead(id), [id]);

  // Action Modals State
  const [actionLoading, setActionLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');
  
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  const [showConfirmProjectModal, setShowConfirmProjectModal] = useState(false);

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertData, setConvertData] = useState({ 
    full_project_amount: '', 
    advance_amount: '', 
    advance_received: 'NO', // Added YES/NO explicit tracking
    requirements: '', 
    specifications: '', 
    website_expectations: '',
    notes: ''
  });

  const [toast, setToast] = useState(null);

  if (loading) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return null;

  const { lead, followups, activeEscalation } = data;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAction = async (actionFn, successMsg) => {
    setActionLoading(true);
    try {
      await actionFn();
      showToast(successMsg);
      setShowStatusModal(false);
      setShowFollowupModal(false);
      setShowEscalateModal(false);
      setShowConvertModal(false);
      setShowConfirmProjectModal(false);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isSalesOrAdmin = user.role === 'admin' || (user.role === 'sales' && lead.assigned_to === user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 className="page-title">{lead.client_name}</h1>
            <StatusBadge status={lead.status} />
          </div>
          <p className="page-desc">{lead.lead_id} {lead.org_name ? `— ${lead.org_name}` : ''}</p>
        </div>
        
        {isSalesOrAdmin && !['CONVERTED', 'LOST'].includes(lead.status) && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setShowFollowupModal(true)}>
              Follow-up
            </button>
            <button className="btn btn-warning" onClick={() => setShowEscalateModal(true)}>
              Push to Manager
            </button>
            {lead.advance_received && !lead.project_confirmed && (
              <button className="btn btn-success" onClick={() => setShowConfirmProjectModal(true)}>
                CONFIRM PROJECT & SEND
              </button>
            )}
            {lead.status !== 'NEW' && !lead.project_confirmed && (
              <button className="btn btn-primary" onClick={() => {
                setConvertData({
                  ...convertData,
                  full_project_amount: lead.quoted_amount || '',
                  advance_amount: lead.advance_amount || '',
                  requirements: lead.requirements || ''
                });
                setShowConvertModal(true);
              }}>
                Push to Admin
              </button>
            )}
          </div>
        )}
      </div>

      <div className="lead-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card">
            <h3 className="section-title">Lead Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Client Name</span>
                <span className="detail-value">{lead.client_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Phone Number</span>
                <span className="detail-value">{lead.phone}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email Address</span>
                <span className="detail-value">{lead.email || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Organization</span>
                <span className="detail-value">{lead.org_name || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Source</span>
                <span className="detail-value">{lead.source}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Quoted Amount</span>
                <span className="detail-value">{formatCurrency(lead.quoted_amount)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Advance Received</span>
                <span className="detail-value" style={{ color: lead.advance_received ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                  {lead.advance_received ? 'Yes' : 'No'}
                </span>
              </div>
              {lead.google_business_url && (
                <div className="detail-item">
                  <span className="detail-label">Google Business</span>
                  <span className="detail-value"><ExternalLink url={lead.google_business_url} label="Profile Link" /></span>
                </div>
              )}
              {lead.instagram_url && (
                <div className="detail-item">
                  <span className="detail-label">Instagram</span>
                  <span className="detail-value"><ExternalLink url={lead.instagram_url} label="Profile Link" /></span>
                </div>
              )}
            </div>
            
            {lead.notes && (
              <div className="detail-item" style={{ marginTop: '24px' }}>
                <span className="detail-label">Initial Notes</span>
                <div className="detail-value" style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-elevated)', padding: '12px', borderRadius: '8px' }}>
                  {lead.notes}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="section-title">Follow-ups History</h3>
            <div className="timeline">
              {followups.map((f, i) => (
                <div key={f.id} className="timeline-item">
                  <div className="timeline-dot" style={{ borderColor: f.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)', color: f.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)' }}>
                    {f.status === 'COMPLETED' ? '✓' : '!'}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-title">Follow-up {f.status === 'PENDING' ? 'Scheduled' : 'Completed'}</div>
                    <div className="timeline-time">Date: {formatDateTime(f.followup_date)}</div>
                    {f.notes && <div className="timeline-desc">{f.notes}</div>}
                    {f.outcome_notes && <div className="timeline-desc" style={{ color: 'var(--text-primary)', marginTop: '8px', background: 'var(--bg-elevated)', padding: '8px', borderRadius: '4px' }}>Outcome: {f.outcome_notes}</div>}
                  </div>
                </div>
              ))}
              {followups.length === 0 && <p className="text-muted">No follow-ups recorded.</p>}
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card">
            <h3 className="section-title">Sales Assignment</h3>
            <div className="detail-item">
              <span className="detail-label">Assigned To</span>
              <span className="font-bold">{lead.assigned_to_name || 'Unassigned'}</span>
            </div>
            <div className="detail-item" style={{ marginTop: '12px' }}>
              <span className="detail-label">Created At</span>
              <span className="detail-value">{formatDateTime(lead.created_at)}</span>
            </div>
          </div>

          {activeEscalation && (
            <div className="card" style={{ border: '1px solid var(--warning)' }}>
              <h3 className="section-title" style={{ color: 'var(--warning)' }}>Active Manager Review</h3>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span><StatusBadge status={activeEscalation.status} size="sm" /></span>
              </div>
              <div className="detail-item" style={{ marginTop: '12px' }}>
                <span className="detail-label">Sales Reason</span>
                <span className="detail-value">{activeEscalation.reason}</span>
              </div>
              {activeEscalation.manager_notes && (
                <div className="detail-item" style={{ marginTop: '12px' }}>
                  <span className="detail-label">Manager Notes</span>
                  <span className="detail-value">{activeEscalation.manager_notes}</span>
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>

      {/* MODALS */}
      {isSalesOrAdmin && (
        <>
          <ConfirmModal
            open={showFollowupModal} onClose={() => setShowFollowupModal(false)}
            title="Schedule Follow-up"
            message={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p className="text-muted text-sm">Use this when the client is interested but not ready to finalize.</p>
                <div className="form-group">
                  <label>Date & Time</label>
                  <input type="datetime-local" className="form-control" value={followupDate} onChange={e => setFollowupDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Follow-up Notes</label>
                  <textarea className="form-control" placeholder="E.g., Client is 90% interested. Call again on..." value={followupNotes} onChange={e => setFollowupNotes(e.target.value)} />
                </div>
              </div>
            }
            confirmText="Schedule Follow-up" confirmVariant="btn-primary"
            onConfirm={() => handleAction(() => api.createFollowup(id, { followup_date: followupDate, notes: followupNotes }), 'Follow-up scheduled')}
            loading={actionLoading}
          />

          <ConfirmModal
            open={showEscalateModal} onClose={() => setShowEscalateModal(false)}
            title="Push to Manager"
            message={
              <div className="form-group">
                <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
                  Use this when you need a manager to speak directly with the client to confirm the project.
                </p>
                <label>Reason for Manager Review</label>
                <textarea className="form-control" placeholder="E.g., Client wants a discount, needs manager confirmation." value={escalateReason} onChange={e => setEscalateReason(e.target.value)} />
              </div>
            }
            confirmText="Push to Manager" confirmVariant="btn-warning"
            onConfirm={() => handleAction(() => api.escalateLead(id, { reason: escalateReason }), 'Lead sent to Manager for review')}
            loading={actionLoading}
          />

          <ConfirmModal
            open={showConfirmProjectModal} onClose={() => setShowConfirmProjectModal(false)}
            title="Confirm Project & Send to Founder"
            message={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p className="text-sm">
                  You are confirming that the advance amount (<strong>{formatCurrency(lead.advance_amount)}</strong>) has been received for this lead.
                </p>
                <p className="text-sm text-muted">
                  This will convert the lead into a project and send it to the Founder for payout allocation. Are you sure you want to proceed?
                </p>
              </div>
            }
            confirmText="Confirm & Send" confirmVariant="btn-success"
            onConfirm={() => handleAction(() => api.confirmProject(id), 'Project confirmed and sent to Founder')}
            loading={actionLoading}
          />

          <ConfirmModal
            open={showConvertModal} onClose={() => setShowConvertModal(false)}
            title="Push to Admin"
            message={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
                <p className="text-muted text-sm">
                  Use this when the client has agreed to terms and the project is ready for Admin review.
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label>Total Project Value (₹)</label>
                    <input type="number" className="form-control" value={convertData.full_project_amount} onChange={e => setConvertData({...convertData, full_project_amount: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Advance Amount (₹)</label>
                    <input type="number" className="form-control" value={convertData.advance_amount} onChange={e => setConvertData({...convertData, advance_amount: e.target.value})} />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Advance Received?</label>
                  <select 
                    className="form-control" 
                    value={convertData.advance_received} 
                    onChange={e => setConvertData({...convertData, advance_received: e.target.value})}
                    style={{ fontWeight: 600, color: convertData.advance_received === 'YES' ? 'var(--success)' : 'var(--warning)' }}
                  >
                    <option value="NO">NO — ADVANCE NOT RECEIVED</option>
                    <option value="YES">YES — ADVANCE RECEIVED</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Core Requirements / Specifications</label>
                  <textarea className="form-control" style={{ minHeight: '100px' }} value={convertData.requirements} onChange={e => setConvertData({...convertData, requirements: e.target.value})} />
                </div>
                
                <div className="form-group">
                  <label>Important Project Notes</label>
                  <textarea className="form-control" value={convertData.notes} onChange={e => setConvertData({...convertData, notes: e.target.value})} />
                </div>
              </div>
            }
            confirmText="Push to Admin" confirmVariant="btn-primary"
            onConfirm={() => {
              const payload = { ...convertData };
              // We pass advance status explicitly as part of notes/requirements so admin can see it
              if (convertData.advance_received === 'NO') {
                payload.notes = `[ADVANCE NOT RECEIVED]\n${payload.notes}`;
              } else {
                payload.notes = `[ADVANCE RECEIVED]\n${payload.notes}`;
              }
              return handleAction(() => api.convertLead(id, payload), 'Project sent to Admin for review');
            }}
            loading={actionLoading}
          />
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
