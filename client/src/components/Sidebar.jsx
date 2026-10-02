import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './shared';

const NAV_CONFIG = {
  admin: [
    { label: 'Founder Access', items: [
      { path: '/admin', label: 'Dashboard', icon: '📊', exact: true },
      { path: '/admin/leads', label: 'Leads', icon: '🎯' },
      { path: '/admin/escalations', label: 'Manager Escalations', icon: '🔺' },
      { path: '/admin/projects', label: 'Projects', icon: '📁' },
    ]},
    { label: 'Team', items: [
      { path: '/admin/developers', label: 'Developers', icon: '💻' },
      { path: '/admin/sales-team', label: 'Sales Team', icon: '👥' },
    ]},
    { label: 'Finance', items: [
      { path: '/admin/wallets', label: 'Wallets', icon: '💰' },
      { path: '/admin/withdrawals', label: 'Withdrawals', icon: '💸' },
    ]},
    { label: 'System', items: [
      { path: '/admin/employees', label: 'Employee Management', icon: '👥' },
      { path: '/admin/reports', label: 'Reports', icon: '📈' },
      { path: '/admin/notifications', label: 'Notifications', icon: '🔔' },
    ]},
  ],
  sales: [
    { label: 'Main', items: [
      { path: '/sales', label: 'Dashboard', icon: '📊', exact: true },
      { path: '/sales/leads', label: 'My Leads', icon: '🎯' },
      { path: '/sales/followups', label: 'Follow-ups', icon: '📅' },
      { path: '/sales/escalations', label: 'Escalations', icon: '🔺' },
      { path: '/sales/projects', label: 'Converted Projects', icon: '📁' },
      { path: '/sales/wallet', label: 'My Wallet', icon: '💰' },
      { path: '/sales/notifications', label: 'Notifications', icon: '🔔' },
    ]},
  ],
  manager: [
    { label: 'Main', items: [
      { path: '/manager', label: 'Dashboard', icon: '📊', exact: true },
      { path: '/manager/escalations', label: 'Escalated Leads', icon: '🔺' },
      { path: '/manager/followups', label: 'Follow-ups', icon: '📅' },
      { path: '/manager/notifications', label: 'Notifications', icon: '🔔' },
    ]},
  ],
  developer: [
    { label: 'Main', items: [
      { path: '/developer', label: 'Dashboard', icon: '📊', exact: true },
      { path: '/developer/projects', label: 'Available Projects', icon: '🆕' },
      { path: '/developer/my-project', label: 'My Active Project', icon: '⚡' },
      { path: '/developer/completed', label: 'Completed Projects', icon: '✅' },
      { path: '/developer/wallet', label: 'My Wallet', icon: '💰' },
      { path: '/developer/notifications', label: 'Notifications', icon: '🔔' },
    ]},
  ],
};

export default function Sidebar({ unreadCount, mobileOpen, setMobileOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;
  const sections = NAV_CONFIG[user.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">D</div>
        <div>
          <div className="logo-text">Dominova</div>
          <div className="logo-sub">Internal OS</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (window.innerWidth <= 768 && setMobileOpen) {
                    setMobileOpen(false);
                  }
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.label === 'Notifications' && unreadCount > 0 && (
                  <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={handleLogout} title="Click to logout">
          <Avatar name={user.name} />
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role} · Logout</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
