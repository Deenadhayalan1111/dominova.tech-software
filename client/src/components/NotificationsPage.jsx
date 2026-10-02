import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, Spinner, Alert, timeAgo } from './shared';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { setUnreadCount } = useAuth();
  const { data, loading, error, refetch } = useApi(() => api.getNotifications({ limit: 100 }));
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (data) {
      setUnreadCount(data.unreadCount);
    }
  }, [data, setUnreadCount]);

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await api.markAllRead();
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setMarking(false);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try { await api.markNotificationRead(notif.id); } catch (e) {}
    }
    if (notif.link) {
      navigate(notif.link);
    } else {
      refetch();
    }
  };

  if (loading && !data) return <Spinner size="lg" />;
  if (error) return <Alert type="error">{error}</Alert>;

  const notifications = data?.notifications || [];

  const icons = {
    INFO: { icon: 'ℹ️', bg: 'var(--info-bg)' },
    SUCCESS: { icon: '✅', bg: 'var(--success-bg)' },
    WARNING: { icon: '⚠️', bg: 'var(--warning-bg)' },
    ERROR: { icon: '❌', bg: 'var(--error-bg)' },
    ACTION_REQUIRED: { icon: '🔺', bg: 'rgba(99,102,241,0.2)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-desc">Your recent alerts and messages</p>
        </div>
        {data?.unreadCount > 0 && (
          <button className="btn btn-ghost" onClick={handleMarkAllRead} disabled={marking}>
            Mark all as read
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {notifications.length > 0 ? (
          notifications.map(n => {
            const style = icons[n.type] || icons.INFO;
            return (
              <div 
                key={n.id} 
                className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="notif-type-icon" style={{ background: style.bg }}>{style.icon}</div>
                <div style={{ flex: 1 }}>
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-time">{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && <div className="notif-dot-unread" />}
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <div className="empty-title">All caught up!</div>
            <div className="empty-desc">You have no new notifications.</div>
          </div>
        )}
      </div>
    </div>
  );
}
