import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi, Spinner, Alert, StatusBadge, formatCurrency, formatDateTime, ExternalLink, Avatar, ConfirmModal } from './shared';
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

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(() => api.getProject(id), [id]);

  const [message, setMessage] = useState('');
  const [submittingMsg, setSubmittingMsg] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState(null);
  
  // Modals state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [devPayout, setDevPayout] = useState('');
  const [backendPayout, setBackendPayout] = useState('');
  const [hostingPayout, setHostingPayout] = useState('');
  const [deadline, setDeadline] = useState('');
  const [salesCommission, setSalesCommission] = useState('');
  const [submitUrl, setSubmitUrl] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showFinalApproveModal, setShowFinalApproveModal] = useState(false);
  const [showFinalRejectModal, setShowFinalRejectModal] = useState(false);

  if (loading) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return null;

  const { project, statusHistory, messages, revisions } = data;

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmittingMsg(true);
    try {
      await api.sendProjectMessage(id, message);
      setMessage('');
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingMsg(false);
    }
  };

  const handleAction = async (actionFn, successMsg) => {
    setActionLoading(true); setActionError('');
    try {
      await actionFn();
      showToast(successMsg);
      setShowRejectModal(false);
      setShowApproveModal(false);
      setShowSubmitModal(false);
      setShowFinalApproveModal(false);
      setShowFinalRejectModal(false);
      refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isDev = user.role === 'developer';
  const isAdmin = user.role === 'admin';

  // Calculate days remaining
  let daysRemaining = null;
  if (project.deadline && !['COMPLETED', 'CLOSED'].includes(project.status)) {
    const diffTime = new Date(project.deadline) - new Date();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {actionError && <Alert type="error" onClose={() => setActionError('')}>{actionError}</Alert>}
      
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 className="page-title">{project.project_id}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="page-desc">{project.client_name} {project.org_name ? `— ${project.org_name}` : ''}</p>
        </div>
        
        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Admin Actions */}
          {isAdmin && project.status === 'PENDING_ADMIN_APPROVAL' && (
            <>
              <button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>Return to Sales</button>
              <button className="btn btn-success" onClick={() => {
                setDevPayout(project.developer_payout || '');
                setBackendPayout(project.backend_payout || '');
                setHostingPayout(project.hosting_payout || '');
                setDeadline(project.deadline ? project.deadline.split('T')[0] : '');
                setShowApproveModal(true);
              }}>Approve Project</button>
            </>
          )}
          {isAdmin && project.status === 'PENDING_FINAL_APPROVAL' && (
            <>
              <button className="btn btn-warning" onClick={() => setShowFinalRejectModal(true)}>Request Changes</button>
              <button className="btn btn-success" onClick={() => setShowFinalApproveModal(true)}>Approve & Credit Wallets</button>
            </>
          )}

          {/* Developer Actions */}
          {isDev && project.status === 'AVAILABLE_FOR_DEVELOPER' && (
            <button className="btn btn-primary" onClick={() => handleAction(() => api.acceptProject(id), 'Project accepted! You are now assigned.')} disabled={actionLoading}>
              {actionLoading ? <Spinner /> : 'Accept Project'}
            </button>
          )}
          {isDev && project.developer_id === user.id && ['ASSIGNED', 'IN_DEVELOPMENT', 'TESTING', 'REVISION_REQUIRED'].includes(project.status) && (
            <button className="btn btn-success" onClick={() => setShowSubmitModal(true)}>
              Submit Project
            </button>
          )}
          {isDev && project.developer_id === user.id && project.status === 'ASSIGNED' && (
            <button className="btn btn-secondary" onClick={() => handleAction(() => api.updateProjectStatus(id, { status: 'IN_DEVELOPMENT' }), 'Status updated to In Development')} disabled={actionLoading}>
              Start Development
            </button>
          )}
        </div>
      </div>

      <div className="lead-detail-grid">
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Developer Specific Banner */}
          {isDev && project.developer_id === user.id && ['ASSIGNED', 'IN_DEVELOPMENT', 'TESTING', 'REVISION_REQUIRED'].includes(project.status) && (
            <div className="card" style={{ border: '1px solid var(--brand-primary)', background: 'rgba(212, 175, 55, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--brand-primary)' }}>Your Active Project</h3>
                  <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>Complete this before accepting another project.</p>
                </div>
                {daysRemaining !== null && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-bold" style={{ fontSize: '18px', color: daysRemaining < 2 ? 'var(--danger)' : daysRemaining < 5 ? 'var(--warning)' : 'var(--text-primary)' }}>
                      {daysRemaining} Days Remaining
                    </div>
                    <div className="text-xs text-muted">Deadline: {formatDateTime(project.deadline)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Info Card */}
          <div className="card">
            <h3 className="section-title">Requirements & Details</h3>
            <div className="detail-grid" style={{ marginBottom: '24px' }}>
              <div className="detail-item">
                <span className="detail-label">Client Name</span>
                <span className="detail-value">{project.client_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Phone</span>
                <span className="detail-value">{project.phone}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Google Business</span>
                <span className="detail-value"><ExternalLink url={project.google_business_url} label="View Profile" /></span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Instagram</span>
                <span className="detail-value"><ExternalLink url={project.instagram_url} label="View Profile" /></span>
              </div>
            </div>

            <div className="detail-item" style={{ marginBottom: '16px' }}>
              <span className="detail-label">Core Requirements</span>
              <div className="detail-value" style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-elevated)', padding: '12px', borderRadius: '8px' }}>
                {project.requirements}
              </div>
            </div>

            {project.specifications && (
              <div className="detail-item" style={{ marginBottom: '16px' }}>
                <span className="detail-label">Technical Specifications</span>
                <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{project.specifications}</div>
              </div>
            )}
            
            {project.website_expectations && (
              <div className="detail-item">
                <span className="detail-label">Design Expectations</span>
                <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{project.website_expectations}</div>
              </div>
            )}
          </div>

          {/* Revisions History (if any) */}
          {revisions?.length > 0 && (
            <div className="card" style={{ border: '1px solid rgba(249,115,22,0.3)' }}>
              <h3 className="section-title" style={{ color: 'var(--warning)' }}>Revisions History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {revisions.map(rev => (
                  <div key={rev.id} style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="badge badge-REVISION_REQUIRED">Revision #{rev.revision_number}</span>
                      <span className="text-xs text-muted">{formatDateTime(rev.rejected_at)}</span>
                    </div>
                    <p style={{ fontSize: '14px' }}>{rev.rejection_reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="card">
            <h3 className="section-title">Project Messages</h3>
            <div className="chat-container">
              {messages.map(msg => {
                const isMine = msg.sender_id === user.id;
                return (
                  <div key={msg.id} className={`chat-message ${isMine ? 'mine' : ''}`}>
                    <Avatar name={msg.sender_name} size={32} />
                    <div className="chat-bubble">
                      <div className="chat-sender">{msg.sender_name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({msg.sender_role})</span></div>
                      <div className="chat-text">{msg.message}</div>
                      <div className="chat-time">{formatDateTime(msg.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && <p className="text-muted text-center" style={{ padding: '20px' }}>No messages yet.</p>}
            </div>
            
            {(isDev && project.developer_id === user.id) || !isDev ? (
              <form onSubmit={handleSendMessage} className="chat-input-wrapper">
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Type a message..." 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  disabled={submittingMsg}
                />
                <button type="submit" className="btn btn-primary" disabled={submittingMsg || !message.trim()}>Send</button>
              </form>
            ) : null}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Team & Finances */}
          <div className="card">
            <h3 className="section-title">Project Team</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar name={project.salesperson_name} />
                <div>
                  <div className="font-bold">{project.salesperson_name}</div>
                  <div className="text-xs text-muted">Salesperson</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {project.developer_id ? (
                  <>
                    <Avatar name={project.developer_name} />
                    <div>
                      <div className="font-bold">{project.developer_name}</div>
                      <div className="text-xs text-muted">Developer</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="user-avatar" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>?</div>
                    <div className="text-muted">Unassigned Developer</div>
                  </>
                )}
              </div>
            </div>

            <h3 className="section-title">Finances</h3>
            <div className="detail-item" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-sm">Client Project Value:</span>
                <span className="font-bold">{isAdmin || user.role === 'sales' ? formatCurrency(project.full_project_amount) : 'Hidden'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-sm text-muted">Advance Paid:</span>
                <span className="font-bold text-muted">{isAdmin || user.role === 'sales' ? formatCurrency(project.advance_amount) : 'Hidden'}</span>
              </div>
            </div>
            
            <div className="section-divider" style={{ margin: '12px 0' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-sm">Frontend Payout:</span>
                <span className="font-bold" style={{ color: 'var(--success)', fontSize: '14px' }}>
                  {project.developer_payout ? formatCurrency(project.developer_payout) : 'Pending'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-sm">Backend Payout:</span>
                <span className="font-bold" style={{ color: 'var(--success)', fontSize: '14px' }}>
                  {project.backend_payout ? formatCurrency(project.backend_payout) : 'Pending'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-sm">Hosting Payout:</span>
                <span className="font-bold" style={{ color: 'var(--success)', fontSize: '14px' }}>
                  {project.hosting_payout ? formatCurrency(project.hosting_payout) : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Submission Info */}
          {project.final_website_url && (
            <div className="card" style={{ border: '1px solid var(--brand-primary)' }}>
              <h3 className="section-title" style={{ color: 'var(--brand-primary-light)' }}>Final Submission</h3>
              <div className="detail-item">
                <span className="detail-label">Website URL</span>
                <a href={project.final_website_url} target="_blank" rel="noreferrer" className="btn btn-secondary w-full" style={{ marginTop: '8px' }}>
                  Open Website 🔗
                </a>
              </div>
            </div>
          )}

          {/* Status Timeline */}
          <div className="card">
            <h3 className="section-title">Timeline</h3>
            <div className="timeline">
              {statusHistory.map((sh, idx) => (
                <div key={sh.id} className="timeline-item">
                  <div className="timeline-dot" style={{ 
                    borderColor: idx === statusHistory.length - 1 ? 'var(--brand-primary)' : 'var(--border)',
                    color: idx === statusHistory.length - 1 ? 'var(--brand-primary)' : 'inherit'
                  }}>✓</div>
                  <div className="timeline-content">
                    <div className="timeline-title">Status changed to {sh.new_status.replace(/_/g, ' ')}</div>
                    <div className="timeline-time">{formatDateTime(sh.created_at)} by {sh.changed_by_name}</div>
                    {sh.notes && <div className="timeline-desc">{sh.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* MODALS */}
      {isAdmin && (
        <>
          <ConfirmModal
            open={showRejectModal} onClose={() => setShowRejectModal(false)}
            title="Return Project to Sales"
            message={
              <div>
                <p style={{ marginBottom: '16px' }}>Send this project back to the salesperson. Please provide a reason.</p>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Missing requirements, price too low" 
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            }
            confirmText="Return Project" confirmVariant="btn-danger"
            onConfirm={() => handleAction(() => api.rejectProject(id, { rejection_reason: rejectReason }), 'Project returned to Sales')}
            loading={actionLoading}
          />

          <ConfirmModal
            open={showApproveModal} onClose={() => setShowApproveModal(false)}
            title="Approve & Publish Project"
            message={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Alert type="info">Approving this project will make it available for developers to pick up.</Alert>
                <div className="form-group">
                  <label>Frontend Payout (₹)</label>
                  <input type="number" className="form-control" placeholder="e.g. 8000" value={devPayout} onChange={e => setDevPayout(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Backend Payout (₹)</label>
                  <input type="number" className="form-control" placeholder="e.g. 5000" value={backendPayout} onChange={e => setBackendPayout(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Hosting Payout (₹)</label>
                  <input type="number" className="form-control" placeholder="e.g. 2000" value={hostingPayout} onChange={e => setHostingPayout(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Project Deadline</label>
                  <input type="date" className="form-control" value={deadline} onChange={e => setDeadline(e.target.value)} />
                </div>
              </div>
            }
            confirmText="Approve & Publish" confirmVariant="btn-success"
            onConfirm={() => handleAction(() => api.approveProject(id, { 
              developer_payout: devPayout, 
              backend_payout: backendPayout,
              hosting_payout: hostingPayout,
              deadline 
            }), 'Project approved and made available to developers')}
            loading={actionLoading}
          />

          <ConfirmModal
            open={showFinalApproveModal} onClose={() => setShowFinalApproveModal(false)}
            title="Final Approval"
            message={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Alert type="success">This will close the project and instantly credit the Developer's Wallet.</Alert>
                <div className="form-group">
                  <label>Total Developer Payout (Based on selection)</label>
                  <div className="form-control" style={{ background: 'var(--bg-dark-base)', color: 'var(--success)', fontWeight: 'bold' }}>
                    {/* The API calculates the real total dynamically on the backend now, this is just for display */}
                    Calculated Automatically
                  </div>
                </div>
                <div className="form-group">
                  <label>Sales Commission (₹) - Optional</label>
                  <input type="number" className="form-control" placeholder="Amount to credit Salesperson" value={salesCommission} onChange={e => setSalesCommission(e.target.value)} />
                </div>
              </div>
            }
            confirmText="Approve & Pay" confirmVariant="btn-success"
            onConfirm={() => handleAction(() => api.finalApproveProject(id, { sales_commission: salesCommission, admin_notes: 'Final approval granted.' }), 'Project completed! Wallets credited.')}
            loading={actionLoading}
          />

          <ConfirmModal
            open={showFinalRejectModal} onClose={() => setShowFinalRejectModal(false)}
            title="Request Changes"
            message={
              <div>
                <p style={{ marginBottom: '16px' }}>What needs to be fixed before final approval?</p>
                <textarea className="form-control" placeholder="E.g., Mobile navigation is not working. Please fix it." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              </div>
            }
            confirmText="Request Revisions" confirmVariant="btn-warning"
            onConfirm={() => handleAction(() => api.finalRejectProject(id, { rejection_reason: rejectReason }), 'Revision requested. Developer notified.')}
            loading={actionLoading}
          />
        </>
      )}

      {isDev && (
        <ConfirmModal
          open={showSubmitModal} onClose={() => setShowSubmitModal(false)}
          title="Submit Project"
          message={
            <div>
              <p style={{ marginBottom: '16px' }}>Please provide the final live URL of the completed website.</p>
              <div className="form-group">
                <label>Website URL</label>
                <input type="url" className="form-control" placeholder="https://www.clientwebsite.com" value={submitUrl} onChange={e => setSubmitUrl(e.target.value)} />
              </div>
            </div>
          }
          confirmText="Submit for Final Review" confirmVariant="btn-primary"
          onConfirm={() => handleAction(() => api.submitProject(id, { final_website_url: submitUrl }), 'Project submitted for final admin review')}
          loading={actionLoading}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
