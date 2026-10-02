import { useState, useEffect } from 'react';
import { useApi, Spinner, Alert, StatusBadge, formatDateTime, Avatar, ConfirmModal } from '../../components/shared';
import { api } from '../../api/client';
import EmployeeForm from './EmployeeForm';
import ManualCreditModal from './ManualCreditModal';

export default function EmployeesList() {
  const { data, loading, error, refetch } = useApi(() => api.getUsers());
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [showCreditModal, setShowCreditModal] = useState(false);

  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleDeactivate = async () => {
    if (!userToDeactivate) return;
    setActionLoading(true);
    try {
      await api.updateUser(userToDeactivate.id, { is_active: userToDeactivate.is_active ? 0 : 1 });
      setShowDeactivateModal(false);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;

  const users = data?.users || [];
  
  const filteredUsers = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (domainFilter && u.domain !== domainFilter) return false;
    if (statusFilter === 'active' && u.is_active !== 1) return false;
    if (statusFilter === 'inactive' && u.is_active !== 0) return false;
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && 
          !(u.employee_id || '').toLowerCase().includes(q) &&
          !(u.username || '').toLowerCase().includes(q) &&
          !(u.email || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const uniqueDomains = [...new Set(users.map(u => u.domain).filter(Boolean))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Employee Management</h1>
          <p className="page-desc">Manage all DOMINOVA staff, access levels, and domains.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowCreditModal(true)}
          >
            + Add Wallet Amount
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => { setEditingUser(null); setShowForm(true); }}
          >
            + Add Employee
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search name, ID, username..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select className="form-control" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="sales">Sales</option>
            <option value="developer">Developer</option>
            <option value="manager">Manager</option>
            <option value="admin">Founder / Admin</option>
          </select>
          <select className="form-control" value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
            <option value="">All Domains</option>
            {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role & Domain</th>
                <th>Login Credentials</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar name={u.name} url={u.avatar_url} />
                      <div>
                        <div className="font-bold">{u.name}</div>
                        <div className="text-xs text-muted">{u.employee_id || 'No ID'} | {u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="font-bold" style={{ textTransform: 'capitalize' }}>{u.role === 'admin' ? 'Founder' : u.role}</div>
                    <div className="text-xs text-muted">{u.domain || 'No Domain'}</div>
                  </td>
                  <td>
                    {u.login_access === 1 ? (
                      <>
                        <div className="font-bold" style={{ color: 'var(--brand-primary-light)' }}>@{u.username || u.email.split('@')[0]}</div>
                        <div className="text-xs text-muted">Access Enabled</div>
                      </>
                    ) : (
                      <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>No Login Access</div>
                    )}
                  </td>
                  <td>{u.joining_date ? formatDateTime(u.joining_date).split(',')[0] : '—'}</td>
                  <td>
                    <StatusBadge status={u.is_active ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditingUser(u); setShowForm(true); }}>
                        Edit
                      </button>
                      {u.id !== 1 && (
                        <button 
                          className={`btn btn-sm ${u.is_active ? 'btn-warning' : 'btn-success'}`}
                          onClick={() => { setUserToDeactivate(u); setShowDeactivateModal(true); }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.8)', zIndex: 1000, 
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          padding: '40px 20px', overflowY: 'auto'
        }}>
          <div style={{ background: 'var(--bg-dark-base)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '800px', position: 'relative' }}>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ position: 'absolute', top: '16px', right: '16px' }}>✕</button>
            <h2 className="section-title" style={{ marginTop: 0 }}>{editingUser ? 'Edit Employee' : 'Add New Employee'}</h2>
            <EmployeeForm 
              initialData={editingUser} 
              onSuccess={() => { setShowForm(false); refetch(); }}
              onCancel={() => setShowForm(false)} 
            />
          </div>
        </div>
      )}

      {showCreditModal && (
        <ManualCreditModal 
          users={users} 
          onSuccess={() => { setShowCreditModal(false); refetch(); }}
          onCancel={() => setShowCreditModal(false)} 
        />
      )}

      {userToDeactivate && (
        <ConfirmModal
          open={showDeactivateModal}
          onClose={() => setShowDeactivateModal(false)}
          title={userToDeactivate.is_active ? "Deactivate Employee" : "Activate Employee"}
          message={
            userToDeactivate.is_active ? 
            "Are you sure you want to deactivate this employee? They will no longer be able to log in, but their historical records will remain intact." :
            "Are you sure you want to reactivate this employee? They will regain access to the system if login access is enabled."
          }
          confirmText={userToDeactivate.is_active ? "Yes, Deactivate" : "Yes, Activate"}
          confirmVariant={userToDeactivate.is_active ? "btn-danger" : "btn-success"}
          onConfirm={handleDeactivate}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
