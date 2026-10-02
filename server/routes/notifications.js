const express = require('express');
const supabase = require('../db/supabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — Current user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { unread_only, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (unread_only === 'true') query = query.eq('is_read', 0);

    const { data: notifications, error } = await query;
    if (error) throw error;

    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', 0);
    if (countError) throw countError;

    res.json({ notifications: notifications || [], unreadCount: count || 0 });
  } catch (err) {
    console.error('GET notifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications', message: err.message });
  }
});

// PUT /api/notifications/:id/read — Mark notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const { data: notif, error: findError } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (findError) throw findError;
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: 1 })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification', message: err.message });
  }
});

// PUT /api/notifications/mark-all-read — Mark all as read
router.put('/mark-all-read', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: 1 })
      .eq('user_id', req.user.id)
      .eq('is_read', 0);
    if (error) throw error;

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Failed to update notifications', message: err.message });
  }
});

// GET /api/notifications/count — Unread count
router.get('/count', authenticate, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', 0);
    if (error) throw error;

    res.json({ unreadCount: count || 0 });
  } catch (err) {
    console.error('Notification count error:', err);
    res.status(500).json({ error: 'Failed to load notification count', message: err.message });
  }
});

module.exports = router;
