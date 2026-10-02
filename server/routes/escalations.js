const express = require('express');
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { createNotification, createLeadActivity } = require('../middleware/helpers');

const router = express.Router();

async function getEscalation(id) {
  const { data, error } = await supabase
    .from('manager_escalations')
    .select(`*, leads:lead_id (lead_id, client_name, phone, email, org_name, google_business_url, instagram_url, other_url, requirements), salesperson:salesperson_id (id, name), manager:manager_id (id, name)`)
    .eq('id', id)
    .eq('is_deleted', 0)
    .maybeSingle();
  if (error) throw error;
  return data;
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from('manager_escalations')
      .select(`*, leads:lead_id (lead_id, client_name, phone), salesperson:salesperson_id (id, name), manager:manager_id (id, name)`, { count: 'exact' })
      .eq('is_deleted', 0)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.user.role === 'sales') query = query.eq('salesperson_id', req.user.id);
    else if (req.user.role === 'manager') query = query.eq('manager_id', req.user.id);
    else if (req.user.role === 'developer') return res.status(403).json({ error: 'Access denied' });
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    const escalations = (data || []).map(e => ({
      ...e,
      lead_id: e.leads?.lead_id,
      lead_client_name: e.leads?.client_name,
      lead_phone: e.leads?.phone,
      salesperson_name: e.salesperson?.name,
      manager_name: e.manager?.name,
    }));
    res.json({ escalations, total: count || 0 });
  } catch (err) {
    console.error('GET escalations error:', err);
    res.status(500).json({ error: 'Failed to load escalations', message: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const esc = await getEscalation(req.params.id);
    if (!esc) return res.status(404).json({ error: 'Escalation not found' });

    if (req.user.role === 'sales' && esc.salesperson_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'manager' && esc.manager_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'developer') return res.status(403).json({ error: 'Access denied' });

    res.json({
      escalation: {
        ...esc,
        lead_id: esc.leads?.lead_id,
        client_name: esc.leads?.client_name,
        phone: esc.leads?.phone,
        email: esc.leads?.email,
        org_name: esc.leads?.org_name,
        google_business_url: esc.leads?.google_business_url,
        instagram_url: esc.leads?.instagram_url,
        salesperson_name: esc.salesperson?.name,
        manager_name: esc.manager?.name,
      }
    });
  } catch (err) {
    console.error('GET escalation error:', err);
    res.status(500).json({ error: 'Failed to load escalation', message: err.message });
  }
});

router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const esc = await getEscalation(req.params.id);
    if (!esc) return res.status(404).json({ error: 'Escalation not found' });
    if (req.user.role === 'manager' && esc.manager_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const { status, manager_notes, followup_date } = req.body;
    const validStatuses = ['PENDING_MANAGER','IN_DISCUSSION','FOLLOW_UP','CONVERTED','LOST','CLOSED'];
    const updates = {};
    if (status && validStatuses.includes(status)) updates.status = status;
    if (manager_notes !== undefined) updates.manager_notes = manager_notes;
    if (followup_date !== undefined) updates.followup_date = followup_date || null;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });
    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('manager_escalations')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    await createNotification({
      userId: esc.salesperson_id,
      title: 'Manager Updated Escalation',
      message: `Manager has updated your escalation for lead ${esc.leads?.lead_id || esc.lead_id}. Status: ${status || 'updated'}`,
      type: 'INFO', entityType: 'escalation', entityId: esc.id,
      link: `/sales/leads/${esc.lead_id}`,
    });

    res.json({ message: 'Escalation updated', escalation: updated });
  } catch (err) {
    console.error('Update escalation error:', err);
    res.status(500).json({ error: 'Failed to update escalation', message: err.message });
  }
});

router.post('/:id/convert', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const esc = await getEscalation(req.params.id);
    if (!esc) return res.status(404).json({ error: 'Escalation not found' });
    if (req.user.role === 'manager' && esc.manager_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const { full_project_amount, advance_amount, requirements, specifications, website_expectations, notes } = req.body;
    const amount = Number(full_project_amount);
    const advance = Number(advance_amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'full_project_amount is required' });

    const { data: existing, error: maxError } = await supabase
      .from('projects')
      .select('project_id')
      .order('id', { ascending: false })
      .limit(1);
    if (maxError) throw maxError;
    let next = 1;
    const match = existing?.[0]?.project_id?.match(/(\d+)$/);
    if (match) next = parseInt(match[1], 10) + 1;
    const projectId = `DOM-PROJ-${String(next).padStart(4, '0')}`;

    const lead = esc.leads || {};
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        project_id: projectId,
        lead_id: esc.lead_id,
        salesperson_id: esc.salesperson_id,
        client_name: lead.client_name,
        org_name: lead.org_name,
        phone: lead.phone,
        email: lead.email,
        google_business_url: lead.google_business_url,
        instagram_url: lead.instagram_url,
        requirements: requirements || lead.requirements || esc.requirements || 'To be confirmed',
        specifications: specifications || null,
        website_expectations: website_expectations || null,
        full_project_amount: amount,
        advance_amount: advance,
        status: 'PENDING_ADMIN_APPROVAL',
        payment_status: advance > 0 ? 'PARTIAL' : 'PENDING',
        salesperson_notes: notes || esc.manager_notes || null,
      })
      .select('id, project_id')
      .single();
    if (projectError) throw projectError;

    await supabase.from('manager_escalations').update({ status: 'CONVERTED', updated_at: new Date().toISOString() }).eq('id', req.params.id);
    await supabase.from('leads').update({ status: 'CONVERTED', updated_at: new Date().toISOString() }).eq('id', esc.lead_id);

    await createLeadActivity({
      leadId: esc.lead_id, userId: req.user.id, activityType: 'CONVERTED',
      description: `Converted by manager. Project ${project.project_id} created.`,
    });

    const { data: admins, error: adminError } = await supabase.from('users').select('id').eq('role', 'admin').eq('is_active', 1);
    if (adminError) throw adminError;
    for (const admin of admins || []) {
      await createNotification({
        userId: admin.id, title: 'New Project from Manager',
        message: `Manager converted escalation to project ${project.project_id}`,
        type: 'ACTION_REQUIRED', entityType: 'project', entityId: project.id,
        link: `/admin/projects/${project.id}`,
      });
    }

    res.json({ message: 'Lead converted by manager', projectId: project.project_id, project: project });
  } catch (err) {
    console.error('Convert escalation error:', err);
    res.status(500).json({ error: 'Failed to convert escalation', message: err.message });
  }
});

module.exports = router;
