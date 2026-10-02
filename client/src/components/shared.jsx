// StatusBadge — renders colored badge for any status
export function StatusBadge({ status, size = 'md' }) {
  if (!status) return null;
  const label = status.replace(/_/g, ' ');
  const cls = size === 'sm' ? 'badge' : 'badge';
  // Map some special cases
  const badgeClass = status === 'ASSIGNED' && window.__isBadgeForDev ? 'badge-ASSIGNED_DEV' : `badge-${status}`;
  return <span className={`${cls} ${badgeClass}`}>{label}</span>;
}

// RoleBadge
export function RoleBadge({ role }) {
  return <span className={`badge badge-${role}`}>{role}</span>;
}

// Spinner
export function Spinner({ size = 'sm' }) {
  return <div className={`spinner ${size === 'lg' ? 'spinner-lg' : ''}`} />;
}

// LoadingScreen
export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner spinner-lg" />
      <p style={{ color: 'var(--text-muted)' }}>Loading Dominova OS...</p>
    </div>
  );
}

// EmptyState
export function EmptyState({ icon = '📭', title, desc, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  );
}

// Alert
export function Alert({ type = 'info', children, onClose }) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  return (
    <div className={`alert alert-${type}`}>
      <span>{icons[type]}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && (
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px' }}>×</button>
      )}
    </div>
  );
}

// Modal
export function Modal({ open, onClose, title, children, footer, size = '' }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal ${size ? `modal-${size}` : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {onClose && <button className="modal-close" onClick={onClose}>×</button>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ConfirmModal
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmVariant = 'btn-danger', loading = false }) {
  if (!open) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className={`btn ${confirmVariant}`} onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner /> : confirmText}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
    </Modal>
  );
}

// Currency format
export function formatCurrency(amount) {
  if (amount == null) return '—';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

// Date format
export function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(dt) {
  if (!dt) return '';
  const now = Date.now();
  const d = new Date(dt).getTime();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Avatar initials
export function Avatar({ name, size = 36 }) {
  const initials = name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className="user-avatar" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

// ExternalLink button
export function ExternalLink({ url, label }) {
  if (!url) return <span className="text-muted">—</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="link-external">
      🔗 {label || 'Open'}
    </a>
  );
}

// SearchBar
export function SearchBar({ value, onChange, placeholder = 'Search...', filters }) {
  return (
    <div className="search-bar-wrapper">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {filters}
    </div>
  );
}

// Pagination
export function Pagination({ page, total, limit, onChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
      <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}

// useApi — data fetching hook
import { useState, useEffect } from 'react';
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refetch(); }, deps);

  return { data, loading, error, refetch };
}

// useForm
export function useForm(initialState) {
  const [values, setValues] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const reset = () => { setValues(initialState); setError(null); };

  return { values, setValues, handleChange, submitting, setSubmitting, error, setError, reset };
}
