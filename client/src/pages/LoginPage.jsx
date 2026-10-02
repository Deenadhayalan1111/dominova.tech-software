import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner, Alert } from '../components/shared';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('Username and password required'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await login(username, password);
      const roleRoutes = { admin: '/admin', sales: '/sales', manager: '/manager', developer: '/developer' };
      navigate(roleRoutes[user.role] || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'Sales', username: 'sales', password: '1234', color: '#22d3ee' },
    { role: 'Manager', username: 'manager', password: '1234', color: '#c084fc' },
    { role: 'Developer', username: 'developer', password: '1234', color: '#4ade80' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-dark-base)',
      position: 'relative',
    }}>
      {/* Left panel */}
      <div style={{
        flex: '0 1 520px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px',
        maxWidth: '520px',
        margin: '0 auto',
        width: '100%',
        animation: 'fadeIn 0.5s ease',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '48px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44, height: 44,
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent-dark))',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 800, color: 'var(--text-on-brand)',
            boxShadow: 'var(--shadow-brand)',
          }}>D</div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-on-dark)', letterSpacing: '-0.02em' }}>Dominova</div>
            <div style={{ fontSize: '12px', color: 'var(--text-on-dark-muted)', letterSpacing: '0.02em' }}>Internal Operating System</div>
          </div>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-on-dark)', letterSpacing: '-0.02em' }}>
          Welcome back
        </h1>
        <p style={{ color: 'var(--text-on-dark-muted)', marginBottom: '32px', fontSize: '14px' }}>
          Sign in to access your dashboard
        </p>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: error ? '16px' : 0 }}>
          <div className="form-group">
            <label style={{ color: 'var(--text-on-dark-muted)' }}>Username</label>
            <input
              type="text"
              className="form-control"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              style={{ padding: '12px 14px', background: 'var(--bg-dark-surface)', color: 'var(--text-on-dark)', borderColor: 'var(--border-dark)' }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-on-dark-muted)' }}>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '12px 14px', background: 'var(--bg-dark-surface)', color: 'var(--text-on-dark)', borderColor: 'var(--border-dark)' }}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: '4px', width: '100%', padding: '12px 24px', fontSize: '15px' }}>
            {loading ? <><Spinner /> Signing in...</> : 'Sign In'}
          </button>
        </form>

        {/* Demo accounts */}
        <div style={{ marginTop: '40px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-on-dark-muted)', marginBottom: '12px', textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Quick Access
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {demoAccounts.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => { setUsername(acc.username); setPassword(acc.password); }}
                style={{
                  background: 'var(--bg-dark-surface)',
                  border: '1px solid var(--border-dark)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.background = 'rgba(212,175,55,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-dark)'; e.currentTarget.style.background = 'var(--bg-dark-surface)'; }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-primary)', marginBottom: '3px' }}>{acc.role}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-on-dark-muted)' }}>@{acc.username}</div>
              </button>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-on-dark-muted)', textAlign: 'center', marginTop: '32px' }}>
          © 2026 Dominova Technologies
        </p>
      </div>

      {/* Right decorative panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(212,175,55,0.02) 50%, rgba(212,175,55,0.01) 100%)',
        borderLeft: '1px solid var(--border-dark)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-right-panel">
        {/* Decorative glow orbs */}
        <div style={{ position: 'absolute', top: '10%', right: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '15%', left: '10%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
        
        <div style={{ textAlign: 'center', maxWidth: '380px', position: 'relative', zIndex: 1, animation: 'slideUp 0.6s ease' }}>
          <div style={{ fontSize: '56px', marginBottom: '24px' }}>🚀</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-on-dark)', marginBottom: '12px', letterSpacing: '-0.02em' }}>
            One system for everything
          </h2>
          <p style={{ color: 'var(--text-on-dark-muted)', fontSize: '14px', lineHeight: 1.7 }}>
            Track every lead from first contact to final delivery.
            Sales → Projects → Developers → Payments — all in one place.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '36px' }}>
            {[
              { icon: '🎯', text: 'Lead tracking & follow-ups' },
              { icon: '📁', text: 'Project lifecycle management' },
              { icon: '💻', text: 'Developer assignment & progress' },
              { icon: '💰', text: 'Wallets & earnings system' },
            ].map((f) => (
              <div key={f.text} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                background: 'rgba(23,24,27,0.6)', backdropFilter: 'blur(8px)',
                border: '1px solid var(--border-dark)',
                borderRadius: 'var(--radius-md)', padding: '14px 18px', textAlign: 'left',
              }}>
                <span style={{ fontSize: '18px' }}>{f.icon}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-on-dark-muted)', fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-on-dark-muted)', textAlign: 'center' }}>
            Founder login uses username: <strong>deepak</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
