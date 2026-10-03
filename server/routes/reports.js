const express = require('express');
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

async function countRows(table, filters = []) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const [field, op, value] of filters) q = q[op](field, value);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function sumRows(table, field, filters = []) {
  let q = supabase.from(table).select(`${field}`);
  for (const [name, op, value] of filters) q = q[op](name, value);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

router.get('/overview', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const leadBase = [['is_deleted', 'eq', 0]];
    const projectBase = [['is_deleted', 'eq', 0]];
    const leads = {
      total: await countRows('leads', leadBase),
      new: await countRows('leads', [...leadBase, ['status', 'eq', 'NEW']]),
      follow_up: await countRows('leads', [...leadBase, ['status', 'eq', 'FOLLOW_UP']]),
      manager_review: await countRows('leads', [...leadBase, ['status', 'eq', 'MANAGER_REVIEW']]),
      converted: await countRows('leads', [...leadBase, ['status', 'eq', 'CONVERTED']]),
      lost: await countRows('leads', [...leadBase, ['status', 'eq', 'LOST']]),
    };

    const today = new Date().toISOString().slice(0, 10);
    const projects = {
      pending_admin_approval: await countRows('projects', [...projectBase, ['status', 'eq', 'PENDING_ADMIN_APPROVAL']]),
      available_for_developer: await countRows('projects', [...projectBase, ['status', 'in', ['AVAILABLE_FOR_DEVELOPER', 'AVAILABLE_FOR_DEVELOPERS']]]),
      in_development: await countRows('projects', [...projectBase, ['status', 'in', ['ASSIGNED', 'IN_DEVELOPMENT', 'TESTING']]]),
      pending_final_approval: await countRows('projects', [...projectBase, ['status', 'eq', 'PENDING_FINAL_APPROVAL']]),
      revision_required: await countRows('projects', [...projectBase, ['status', 'eq', 'REVISION_REQUIRED']]),
      completed: await countRows('projects', [...projectBase, ['status', 'eq', 'COMPLETED']]),
      total: await countRows('projects', projectBase),
    };

    const finance = {
      total_project_value: await sumRows('projects', 'full_project_amount', projectBase),
      total_advance: await sumRows('projects', 'advance_amount', projectBase),
      total_developer_payouts: await sumRows('projects', 'developer_payout', [...projectBase, ['status', 'eq', 'COMPLETED']]),
      total_sales_commissions: await sumRows('projects', 'sales_commission', [...projectBase, ['status', 'eq', 'COMPLETED']]),
      total_wallets_balance: await sumRows('wallets', 'available_balance'),
      pending_withdrawals: await countRows('withdrawals', [['status', 'eq', 'PENDING']]),
      pending_withdrawal_amount: await sumRows('withdrawals', 'amount', [['status', 'eq', 'PENDING']]),
    };

    const { data: salesUsers, error: salesError } = await supabase.from('users').select('id, name').eq('role', 'sales').eq('is_active', 1);
    if (salesError) throw salesError;
    const salesByPerson = [];
    for (const u of salesUsers || []) {
      const rows = (await supabase.from('leads').select('status, full_project_amount').eq('assigned_to', u.id).eq('is_deleted', 0)).data || [];
      salesByPerson.push({
        name: u.name, id: u.id,
        active_leads: rows.filter(r => r.status !== 'LOST').length,
        conversions: rows.filter(r => r.status === 'CONVERTED').length,
        lost: rows.filter(r => r.status === 'LOST').length,
        follow_ups: rows.filter(r => r.status === 'FOLLOW_UP').length,
        escalations: rows.filter(r => r.status === 'MANAGER_REVIEW').length,
        revenue_generated: rows.filter(r => r.status === 'CONVERTED').reduce((s, r) => s + Number(r.full_project_amount || 0), 0),
      });
    }

    const { data: devUsers, error: devError } = await supabase.from('users').select('id, name').eq('role', 'developer').eq('is_active', 1);
    if (devError) throw devError;
    const activeStatuses = ['ASSIGNED','IN_DEVELOPMENT','TESTING','SUBMITTED','PENDING_FINAL_APPROVAL','REVISION_REQUIRED'];
    const developerStats = [];
    for (const u of devUsers || []) {
      const { data: active } = await supabase.from('projects').select('id, project_id').eq('developer_id', u.id).in('status', activeStatuses).eq('is_deleted', 0).limit(1);
      const { data: done } = await supabase.from('projects').select('developer_payout').eq('developer_id', u.id).eq('status', 'COMPLETED').eq('is_deleted', 0);
      const { data: wallet } = await supabase.from('wallets').select('available_balance').eq('user_id', u.id).maybeSingle();
      developerStats.push({
        name: u.name, id: u.id, is_available: !(active && active.length),
        active_project: active?.[0]?.project_id || null,
        completed_projects: done?.length || 0,
        total_earned: (done || []).reduce((s, r) => s + Number(r.developer_payout || 0), 0),
        available_balance: Number(wallet?.available_balance || 0),
      });
    }

    const followups_due_today = await countRows('lead_followups', [['status', 'eq', 'PENDING'], ['followup_date', 'gte', today], ['followup_date', 'lt', `${today}T23:59:59`]]);
    const followups_overdue = await countRows('lead_followups', [['status', 'eq', 'PENDING'], ['followup_date', 'lt', today]]);
    leads.followups_due_today = followups_due_today;
    leads.followups_overdue = followups_overdue;

    res.json({ leads, projects, finance, salesByPerson, developerStats });
  } catch (err) {
    console.error('Reports overview error:', err);
    res.status(500).json({ error: 'Failed to load overview report', message: err.message });
  }
});

router.get('/followups', authenticate, requireRole('admin', 'sales', 'manager'), async (req, res) => {
  try {
    const { from_date, to_date, status } = req.query;
    let q = supabase.from('lead_followups').select(`*, leads:lead_id (lead_id, client_name, phone, org_name), creator:created_by (id, name)`).order('followup_date', { ascending: true });
    if (req.user.role === 'sales') q = q.eq('created_by', req.user.id);
    if (status) q = q.eq('status', status);
    if (from_date) q = q.gte('followup_date', from_date);
    if (to_date) q = q.lte('followup_date', to_date);
    const { data, error } = await q;
    if (error) throw error;
    const followups = (data || []).map(f => ({ ...f, lead_id: f.leads?.lead_id, client_name: f.leads?.client_name, phone: f.leads?.phone, org_name: f.leads?.org_name, created_by_name: f.creator?.name, sales_id: f.creator?.id }));
    res.json({ followups });
  } catch (err) {
    console.error('Followups report error:', err);
    res.status(500).json({ error: 'Failed to load followups report', message: err.message });
  }
});

router.get('/audit', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { entity_type, entity_id, user_id, page = 1, limit = 100 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    let q = supabase.from('audit_logs').select(`*, user:user_id (id, name, role)`, { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    if (entity_type) q = q.eq('entity_type', entity_type);
    if (entity_id) q = q.eq('entity_id', entity_id);
    if (user_id) q = q.eq('user_id', user_id);
    const { data, count, error } = await q;
    if (error) throw error;
    const logs = (data || []).map(l => ({ ...l, user_name: l.user?.name, user_role: l.user?.role }));
    res.json({ logs, total: count || 0 });
  } catch (err) {
    console.error('Audit report error:', err);
    res.status(500).json({ error: 'Failed to load audit log', message: err.message });
  }
});

module.exports = router;
