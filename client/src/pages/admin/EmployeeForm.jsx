import { useState } from 'react';
import { api } from '../../api/client';
import { Alert, Spinner } from '../../components/shared';

const DOMAIN_OPTIONS = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Software Developer',
  'UI/UX Designer',
  'Digital Marketing',
  'Testing / QA',
  'Mobile App Developer',
  'Python Developer',
  'Java Developer',
  'Data Analyst',
  'Data Science / ML',
  'HR',
  'Business Analyst',
  'Project Manager',
  'Sales',
  'Other'
];

export default function EmployeeForm({ initialData, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    avatar_url: initialData?.avatar_url || '',
    role: initialData?.role || 'developer',
    domain: initialData?.domain || 'Frontend Developer',
    joining_date: initialData?.joining_date || new Date().toISOString().split('T')[0],
    employee_id: initialData?.employee_id || '',
    login_access: initialData ? initialData.login_access === 1 : true,
    username: initialData?.username || '',
    password: '',
    confirm_password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic Validations
    if (!formData.name || !formData.email) {
      setError('Name and Email are required.'); return;
    }
    if (formData.login_access && !initialData) {
      if (!formData.username) { setError('Username is required when login access is enabled.'); return; }
      if (!formData.password) { setError('Password is required for new accounts with login access.'); return; }
      if (formData.password !== formData.confirm_password) { setError('Passwords do not match.'); return; }
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        login_access: formData.login_access ? 1 : 0
      };

      if (initialData) {
        // Update (don't send password unless we build a password reset feature later, keep it simple for now)
        delete payload.password; 
        delete payload.confirm_password;
        delete payload.username; // Username shouldn't be easily changed to avoid breakage, or we can allow it if API supports it. Our API doesn't update username in PUT.
        delete payload.email; // Same for email
        await api.updateUser(initialData.id, payload);
      } else {
        // Create
        await api.createUser(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {error && <Alert type="error">{error}</Alert>}

      <section>
        <h3 className="section-title" style={{ fontSize: '16px', color: 'var(--brand-primary-light)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          Personal Information
        </h3>
        <div className="form-row">
          <div className="form-group">
            <label>Full Name *</label>
            <input type="text" className="form-control" name="name" value={formData.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input type="tel" className="form-control" name="phone" value={formData.phone} onChange={handleChange} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email Address *</label>
            <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} required disabled={!!initialData} />
            {initialData && <span className="text-xs text-muted">Email cannot be changed after creation.</span>}
          </div>
          <div className="form-group">
            <label>Profile Photo URL (Optional)</label>
            <input type="url" className="form-control" name="avatar_url" value={formData.avatar_url} onChange={handleChange} placeholder="https://..." />
          </div>
        </div>
      </section>

      <section>
        <h3 className="section-title" style={{ fontSize: '16px', color: 'var(--brand-primary-light)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          Work Information
        </h3>
        <div className="form-row">
          <div className="form-group">
            <label>Role *</label>
            <select className="form-control" name="role" value={formData.role} onChange={handleChange} disabled={initialData?.id === 1}>
              <option value="developer">Developer</option>
              <option value="sales">Sales</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div className="form-group">
            <label>Domain *</label>
            <select className="form-control" name="domain" value={formData.domain} onChange={handleChange}>
              {DOMAIN_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Employee ID</label>
            <input type="text" className="form-control" name="employee_id" value={formData.employee_id} onChange={handleChange} placeholder="e.g. DOM-001" />
          </div>
          <div className="form-group">
            <label>Joining Date</label>
            <input type="date" className="form-control" name="joining_date" value={formData.joining_date} onChange={handleChange} />
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: formData.login_access && !initialData ? '24px' : '0' }}>
          <div>
            <h3 className="section-title" style={{ fontSize: '16px', margin: 0 }}>Login Access</h3>
            <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>Allow this employee to log into the DOMINOVA system.</p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <span className="font-bold">{formData.login_access ? 'Enabled' : 'Disabled'}</span>
            <input type="checkbox" name="login_access" checked={formData.login_access} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
          </label>
        </div>

        {formData.login_access && !initialData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Username *</label>
              <input type="text" className="form-control" name="username" value={formData.username} onChange={handleChange} required={formData.login_access} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Password *</label>
                <input type="password" className="form-control" name="password" value={formData.password} onChange={handleChange} required={formData.login_access} />
              </div>
              <div className="form-group">
                <label>Confirm Password *</label>
                <input type="password" className="form-control" name="confirm_password" value={formData.confirm_password} onChange={handleChange} required={formData.login_access} />
              </div>
            </div>
          </div>
        )}
        
        {formData.login_access && initialData && (
          <Alert type="info" style={{ marginTop: '16px' }}>Login access is enabled. Username: <strong>{initialData.username || initialData.email}</strong>. (Password resets must be done by the user).</Alert>
        )}
      </section>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Spinner /> : (initialData ? 'Save Changes' : 'Create Employee')}
        </button>
      </div>
    </form>
  );
}
