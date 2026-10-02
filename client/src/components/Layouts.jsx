import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { LoadingScreen } from './shared';

export function AuthLayout() {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  if (user) {
    const roleRoutes = { admin: '/admin', sales: '/sales', manager: '/manager', developer: '/developer' };
    return <Navigate to={roleRoutes[user.role] || '/'} replace />;
  }
  
  return <Outlet />;
}

export function MainLayout({ allowedRoles }) {
  const { user, loading, unreadCount } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);
  
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const roleRoutes = { admin: '/admin', sales: '/sales', manager: '/manager', developer: '/developer' };
    return <Navigate to={roleRoutes[user.role] || '/'} replace />;
  }

  return (
    <div className="app-layout">
      {/* Mobile Topbar */}
      <div className="mobile-topbar" style={{ display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-icon" style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent-dark))', borderRadius: '6px', color: 'var(--text-on-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>D</div>
          <span style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-on-dark)' }}>Dominova OS</span>
        </div>
        <button className="btn-icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'transparent', color: 'var(--text-on-dark)', fontSize: '24px' }}>
          ☰
        </button>
      </div>

      {/* Overlay for mobile sidebar */}
      {mobileMenuOpen && <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)}></div>}

      <Sidebar unreadCount={unreadCount} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      
      <main className="main-content">
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
