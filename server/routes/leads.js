const express = require('express');

const supabase = require('../db/supabase');

const {
  authenticate,
  requireRole
} = require('../middleware/auth');

const {
  createAuditLog,
  createLeadActivity,
  createNotification
} = require('../middleware/helpers');

const router = express.Router();


// ============================================================
// HELPERS
// ============================================================

async function nextLeadId() {
  const { data, error } = await supabase
    .from('leads')
    .select('lead_id')
    .order('lead_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  let n = 0;

  if (data?.lead_id) {
    const match = data.lead_id.match(/(\d+)$/);
    if (match) n = parseInt(match[1], 10);
  }

  return `DOM-LEAD-${String(n + 1).padStart(4, '0')}`;
}


async function nextProjectId() {
  const { data, error } = await supabase
    .from('projects')
    .select('project_id')
    .order('project_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  let n = 0;

  if (data?.project_id) {
    const match = data.project_id.match(/(\d+)$/);
    if (match) n = parseInt(match[1], 10);
  }

  return `DOM-PROJ-${String(n + 1).padStart(4, '0')}`;
}


async function getLeadWithDetails(leadId) {
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('is_deleted', 0)
    .maybeSingle();

  if (error) throw error;
  if (!lead) return null;

  let assignedUser = null;
  let createdUser = null;

  if (lead.assigned_to) {
    const result = await supabase
      .from('users')
      .select('name, email')
      .eq('id', lead.assigned_to)
      .maybeSingle();

    assignedUser = result.data;
  }

  if (lead.created_by) {
    const result = await supabase
      .from('users')
      .select('name')
      .eq('id', lead.created_by)
      .maybeSingle();

    createdUser = result.data;
  }

  return {
    ...lead,
    assigned_to_name: assignedUser?.name || null,
    assigned_to_email: assignedUser?.email || null,
    created_by_name: createdUser?.name || null
  };
}


// ============================================================
// GET /api/leads
// ============================================================

router.get('/', authenticate, async (req, res) => {
  try {
    const {
      status,
      assigned_to,
      search,
      from_date,
      to_date,
      page = 1,
      limit = 50
    } = req.query;

    const user = req.user;

    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit) || 50, 1),
      100
    );

    const offset = (pageNumber - 1) * limitNumber;

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('is_deleted', 0);

    // Sales can only see their own leads
    if (user.role === 'sales') {
      query = query.eq('assigned_to', user.id);
    }

    // Developers cannot access leads
    if (user.role === 'developer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (assigned_to && user.role === 'admin') {
      query = query.eq('assigned_to', assigned_to);
    }

    if (from_date) {
      query = query.gte(
        'created_at',
        `${from_date}T00:00:00.000Z`
      );
    }

    if (to_date) {
      query = query.lte(
        'created_at',
        `${to_date}T23:59:59.999Z`
      );
    }

    // Search client/org/phone/lead/email
    if (search) {
      const escaped = search
        .replace(/,/g, '')
        .replace(/\./g, '');

      query = query.or(
        `client_name.ilike.%${escaped}%,` +
        `org_name.ilike.%${escaped}%,` +
        `phone.ilike.%${escaped}%,` +
        `lead_id.ilike.%${escaped}%,` +
        `email.ilike.%${escaped}%`
      );
    }

    const {
      data: leads,
      error,
      count
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNumber - 1);

    if (error) {
      console.error(error);

      return res.status(500).json({
        error: 'Failed to fetch leads'
      });
    }

    // Add assigned/created user names
    const enrichedLeads = await Promise.all(
      (leads || []).map(async lead => {
        let assignedUser = null;
        let createdUser = null;

        if (lead.assigned_to) {
          const result = await supabase
            .from('users')
            .select('name, email')
            .eq('id', lead.assigned_to)
            .maybeSingle();

          assignedUser = result.data;
        }

        if (lead.created_by) {
          const result = await supabase
            .from('users')
            .select('name')
            .eq('id', lead.created_by)
            .maybeSingle();

          createdUser = result.data;
        }

        return {
          ...lead,
          assigned_to_name: assignedUser?.name || null,
          assigned_to_email: assignedUser?.email || null,
          created_by_name: createdUser?.name || null
        };
      })
    );

    res.json({
      leads: enrichedLeads,
      total: count || 0,
      page: pageNumber,
      limit: limitNumber
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Server error while fetching leads'
    });
  }
});


// ============================================================
// GET /api/leads/stats
// ============================================================

router.get('/stats', authenticate, async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'developer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const statuses = [
      'NEW',
      'ASSIGNED',
      'CONTACTED',
      'INTERESTED',
      'FOLLOW_UP',
      'MANAGER_REVIEW',
      'CONVERTED',
      'LOST'
    ];

    const stats = {
      total: 0,
      new: 0,
      assigned: 0,
      contacted: 0,
      interested: 0,
      follow_up: 0,
      manager_review: 0,
      converted: 0,
      lost: 0,
      followups_due_today: 0
    };

    for (const currentStatus of statuses) {
      let query = supabase
        .from('leads')
        .select('id', {
          count: 'exact',
          head: true
        })
        .eq('is_deleted', 0)
        .eq('status', currentStatus);

      if (user.role === 'sales') {
        query = query.eq('assigned_to', user.id);
      }

      const { count, error } = await query;

      if (error) throw error;

      const key = currentStatus.toLowerCase();

      stats[key] = count || 0;
      stats.total += count || 0;
    }

    // Follow-ups due today
    const today = new Date().toISOString().slice(0, 10);

    let followupQuery = supabase
      .from('lead_followups')
      .select('id, lead_id', {
        count: 'exact',
        head: true
      })
      .eq('status', 'PENDING')
      .eq('followup_date', today);

    if (user.role === 'sales') {
      const { data: ownLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('assigned_to', user.id)
        .eq('is_deleted', 0);

      const leadIds = (ownLeads || []).map(l => l.id);

      if (leadIds.length === 0) {
        stats.followups_due_today = 0;
      } else {
        const result = await supabase
          .from('lead_followups')
          .select('id', {
            count: 'exact',
            head: true
          })
          .eq('status', 'PENDING')
          .eq('followup_date', today)
          .in('lead_id', leadIds);

        stats.followups_due_today = result.count || 0;
      }
    } else {
      const result = await followupQuery;
      stats.followups_due_today = result.count || 0;
    }

    res.json({ stats });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Failed to fetch lead statistics'
    });
  }
});


// ============================================================
// GET /api/leads/:id
// ============================================================

router.get('/:id', authenticate, async (req, res) => {
  try {
    const lead = await getLeadWithDetails(req.params.id);

    if (!lead) {
      return res.status(404).json({
        error: 'Lead not found'
      });
    }

    if (
      req.user.role === 'sales' &&
      lead.assigned_to !== req.user.id
    ) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (req.user.role === 'developer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const { data: followups, error: followupError } =
      await supabase
        .from('lead_followups')
        .select('*')
        .eq('lead_id', req.params.id)
        .order('followup_date', {
          ascending: false
        });

    if (followupError) throw followupError;

    const enrichedFollowups = await Promise.all(
      (followups || []).map(async followup => {
        const { data: creator } = await supabase
          .from('users')
          .select('name')
          .eq('id', followup.created_by)
          .maybeSingle();

        return {
          ...followup,
          created_by_name: creator?.name || null
        };
      })
    );

    const { data: activities, error: activityError } =
      await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', req.params.id)
        .order('created_at', {
          ascending: false
        });

    if (activityError) throw activityError;

    const enrichedActivities = await Promise.all(
      (activities || []).map(async activity => {
        const { data: activityUser } = await supabase
          .from('users')
          .select('name')
          .eq('id', activity.user_id)
          .maybeSingle();

        return {
          ...activity,
          user_name: activityUser?.name || null
        };
      })
    );

    const { data: escalations, error: escalationError } =
      await supabase
        .from('manager_escalations')
        .select('*')
        .eq('lead_id', req.params.id)
        .eq('is_deleted', 0);

    if (escalationError) throw escalationError;

    const enrichedEscalations = await Promise.all(
      (escalations || []).map(async escalation => {
        let salesperson = null;
        let manager = null;

        if (escalation.salesperson_id) {
          const result = await supabase
            .from('users')
            .select('name')
            .eq('id', escalation.salesperson_id)
            .maybeSingle();

          salesperson = result.data;
        }

        if (escalation.manager_id) {
          const result = await supabase
            .from('users')
            .select('name')
            .eq('id', escalation.manager_id)
            .maybeSingle();

          manager = result.data;
        }

        return {
          ...escalation,
          salesperson_name: salesperson?.name || null,
          manager_name: manager?.name || null
        };
      })
    );

    res.json({
      lead,
      followups: enrichedFollowups,
      activities: enrichedActivities,
      escalations: enrichedEscalations
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Failed to fetch lead details'
    });
  }
});


// ============================================================
// POST /api/leads
// ============================================================

router.post(
  '/',
  authenticate,
  requireRole('admin', 'sales'),
  async (req, res) => {
    try {
      const {
        client_name,
        org_name,
        phone,
        email,
        google_business_url,
        instagram_url,
        other_url,
        lead_source,
        assigned_to,
        notes,
        requirements,
        quoted_amount,
        advance_amount,
        advance_received
      } = req.body;

      if (!client_name || !phone) {
        return res.status(400).json({
          error: 'Client name and phone are required'
        });
      }

      const leadId = await nextLeadId();

      const assignedTo =
        req.user.role === 'sales'
          ? req.user.id
          : (assigned_to || null);

      const status = assignedTo
        ? 'ASSIGNED'
        : 'NEW';

      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          lead_id: leadId,
          client_name,
          org_name: org_name || null,
          phone,
          email: email || null,
          google_business_url: google_business_url || null,
          instagram_url: instagram_url || null,
          other_url: other_url || null,
          lead_source: lead_source || 'Manual',
          assigned_to: assignedTo,
          status,
          notes: notes || null,
          requirements: requirements || null,
          quoted_amount:
            quoted_amount
              ? parseFloat(quoted_amount)
              : null,
          advance_amount:
            advance_amount
              ? parseFloat(advance_amount)
              : 0,
          advance_received:
            advance_received ? 1 : 0,
          created_by: req.user.id
        })
        .select()
        .single();

      if (error) throw error;

      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE_LEAD',
        entityType: 'lead',
        entityId: newLead.id,
        description:
          `Lead ${leadId} created for ${client_name}`
      });

      await createLeadActivity({
        leadId: newLead.id,
        userId: req.user.id,
        activityType: 'CREATED',
        description:
          `Lead created by ${req.user.name}`
      });

      if (
        assignedTo &&
        assignedTo !== req.user.id
      ) {
        await createNotification({
          userId: assignedTo,
          title: 'New Lead Assigned',
          message:
            `You have been assigned lead ${leadId} — ${client_name}`,
          type: 'ACTION_REQUIRED',
          entityType: 'lead',
          entityId: newLead.id,
          link: `/sales/leads/${newLead.id}`
        });
      }

      const detailedLead =
        await getLeadWithDetails(newLead.id);

      res.status(201).json({
        lead: detailedLead,
        message: 'Lead created successfully'
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Failed to create lead'
      });
    }
  }
);


// ============================================================
// PUT /api/leads/:id
// ============================================================

router.put('/:id', authenticate, async (req, res) => {
  try {
    const lead = await getLeadWithDetails(req.params.id);

    if (!lead) {
      return res.status(404).json({
        error: 'Lead not found'
      });
    }

    const user = req.user;

    if (
      user.role === 'sales' &&
      lead.assigned_to !== user.id
    ) {
      return res.status(403).json({
        error: 'Access denied — not your lead'
      });
    }

    if (user.role === 'developer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const allowed = [
      'client_name',
      'org_name',
      'phone',
      'email',
      'google_business_url',
      'instagram_url',
      'other_url',
      'lead_source',
      'notes',
      'requirements',
      'quoted_amount',
      'advance_amount',
      'advance_received'
    ];

    if (user.role === 'admin') {
      allowed.push(
        'assigned_to',
        'status',
        'full_project_amount'
      );
    }

    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', req.params.id);

    if (error) throw error;

    await createLeadActivity({
      leadId: req.params.id,
      userId: user.id,
      activityType: 'UPDATED',
      description:
        `Lead updated by ${user.name}: ${Object.keys(updates).join(', ')}`
    });

    const updated =
      await getLeadWithDetails(req.params.id);

    res.json({
      lead: updated,
      message: 'Lead updated'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Failed to update lead'
    });
  }
});


// ============================================================
// POST /api/leads/:id/assign
// ============================================================

router.post(
  '/:id/assign',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { salesperson_id } = req.body;

      if (!salesperson_id) {
        return res.status(400).json({
          error: 'salesperson_id required'
        });
      }

      const lead = await getLeadWithDetails(req.params.id);

      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found'
        });
      }

      const { data: salesperson, error } =
        await supabase
          .from('users')
          .select('*')
          .eq('id', salesperson_id)
          .eq('role', 'sales')
          .eq('is_active', 1)
          .maybeSingle();

      if (error) throw error;

      if (!salesperson) {
        return res.status(404).json({
          error: 'Salesperson not found'
        });
      }

      const { error: updateError } =
        await supabase
          .from('leads')
          .update({
            assigned_to: salesperson_id,
            status: 'ASSIGNED',
            updated_at: new Date().toISOString()
          })
          .eq('id', req.params.id);

      if (updateError) throw updateError;

      await createLeadActivity({
        leadId: req.params.id,
        userId: req.user.id,
        activityType: 'ASSIGNED',
        description:
          `Lead assigned to ${salesperson.name} by admin`
      });

      await createNotification({
        userId: salesperson_id,
        title: 'Lead Assigned to You',
        message:
          `Lead ${lead.lead_id} (${lead.client_name}) has been assigned to you.`,
        type: 'ACTION_REQUIRED',
        entityType: 'lead',
        entityId: lead.id,
        link: `/sales/leads/${lead.id}`
      });

      res.json({
        message:
          `Lead assigned to ${salesperson.name}`
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Failed to assign lead'
      });
    }
  }
);


// ============================================================
// POST /api/leads/:id/contact
// ============================================================

router.post(
  '/:id/contact',
  authenticate,
  requireRole('admin', 'sales'),
  async (req, res) => {
    try {
      const lead =
        await getLeadWithDetails(req.params.id);

      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found'
        });
      }

      const user = req.user;

      if (
        user.role === 'sales' &&
        lead.assigned_to !== user.id
      ) {
        return res.status(403).json({
          error: 'Access denied — not your lead'
        });
      }

      const { result, notes } = req.body;

      const validResults = [
        'INTERESTED',
        'FOLLOW_UP',
        'MANAGER_REVIEW',
        'CONVERTED',
        'LOST'
      ];

      if (
        !result ||
        !validResults.includes(result)
      ) {
        return res.status(400).json({
          error:
            `Result must be one of: ${validResults.join(', ')}`
        });
      }

      const { error } = await supabase
        .from('leads')
        .update({
          status:
            result === 'CONVERTED'
              ? 'INTERESTED'
              : result,
          notes:
            notes || lead.notes,
          last_contacted_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString()
        })
        .eq('id', req.params.id);

      if (error) throw error;

      await createLeadActivity({
        leadId: req.params.id,
        userId: user.id,
        activityType: 'CONTACTED',
        description:
          `Contact result: ${result}. Notes: ${notes || 'None'}`
      });

      res.json({
        message: 'Contact result recorded',
        status: result
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Failed to record contact'
      });
    }
  }
);


// ============================================================
// POST /api/leads/:id/followup
// ============================================================

router.post(
  '/:id/followup',
  authenticate,
  requireRole('admin', 'sales', 'manager'),
  async (req, res) => {
    try {
      const lead =
        await getLeadWithDetails(req.params.id);

      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found'
        });
      }

      const user = req.user;

      if (
        user.role === 'sales' &&
        lead.assigned_to !== user.id
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      const {
        followup_date,
        followup_time,
        reason,
        client_position,
        notes
      } = req.body;

      if (!followup_date || !reason) {
        return res.status(400).json({
          error:
            'followup_date and reason are required'
        });
      }

      const { data: followup, error } =
        await supabase
          .from('lead_followups')
          .insert({
            lead_id: req.params.id,
            created_by: user.id,
            followup_date,
            followup_time:
              followup_time || null,
            reason,
            client_position:
              client_position || null,
            notes: notes || null
          })
          .select()
          .single();

      if (error) throw error;

      await supabase
        .from('leads')
        .update({
          status: 'FOLLOW_UP',
          next_followup_date: followup_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id);

      await createLeadActivity({
        leadId: req.params.id,
        userId: user.id,
        activityType: 'FOLLOW_UP_CREATED',
        description:
          `Follow-up scheduled for ${followup_date}: ${reason}`
      });

      res.status(201).json({
        message: 'Follow-up created',
        followupId: followup.id
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Failed to create follow-up'
      });
    }
  }
);


// ============================================================
// POST /api/leads/:id/escalate
// ============================================================

router.post(
  '/:id/escalate',
  authenticate,
  requireRole('admin', 'sales'),
  async (req, res) => {
    try {
      const lead =
        await getLeadWithDetails(req.params.id);

      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found'
        });
      }

      const user = req.user;

      if (
        user.role === 'sales' &&
        lead.assigned_to !== user.id
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      const {
        quoted_price,
        requirements,
        reason,
        salesperson_notes,
        manager_id
      } = req.body;

      if (!reason) {
        return res.status(400).json({
          error:
            'Reason for escalation is required'
        });
      }

      let managerId = manager_id || null;

      if (!managerId) {
        const { data: manager } =
          await supabase
            .from('users')
            .select('id')
            .eq('role', 'manager')
            .eq('is_active', 1)
            .limit(1)
            .maybeSingle();

        managerId = manager?.id || null;
      }

      const { data: escalation, error } =
        await supabase
          .from('manager_escalations')
          .insert({
            lead_id: req.params.id,
            salesperson_id: user.id,
            manager_id: managerId,
            quoted_price:
              quoted_price ||
              lead.quoted_amount,
            requirements:
              requirements ||
              lead.requirements,
            reason,
            salesperson_notes:
              salesperson_notes || null
          })
          .select()
          .single();

      if (error) throw error;

      await supabase
        .from('leads')
        .update({
          status: 'MANAGER_REVIEW',
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id);

      await createLeadActivity({
        leadId: req.params.id,
        userId: user.id,
        activityType:
          'ESCALATED_TO_MANAGER',
        description:
          `Lead escalated to manager: ${reason}`
      });

      if (managerId) {
        await createNotification({
          userId: managerId,
          title: 'Lead Escalated to You',
          message:
            `${user.name} has escalated lead ${lead.lead_id} (${lead.client_name}) for your review.`,
          type: 'ACTION_REQUIRED',
          entityType: 'lead',
          entityId: lead.id,
          link:
            `/manager/escalations/${escalation.id}`
        });
      }

      res.status(201).json({
        message:
          'Lead escalated to manager',
        escalationId: escalation.id
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Failed to escalate lead'
      });
    }
  }
);


// ============================================================
// POST /api/leads/:id/convert
// ============================================================

router.post(
  '/:id/convert',
  authenticate,
  requireRole('admin', 'sales', 'manager'),
  async (req, res) => {
    try {
      const lead =
        await getLeadWithDetails(req.params.id);

      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found'
        });
      }

      const user = req.user;

      if (
        user.role === 'sales' &&
        lead.assigned_to !== user.id
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      const {
        client_name,
        org_name,
        phone,
        email,
        google_business_url,
        instagram_url,
        requirements,
        specifications,
        website_expectations,
        full_project_amount,
        advance_amount,
        payment_status,
        salesperson_notes
      } = req.body;

      if (
        !full_project_amount ||
        !requirements
      ) {
        return res.status(400).json({
          error:
            'full_project_amount and requirements are required'
        });
      }

      const projectId =
        await nextProjectId();

      const salespersonId =
        user.role === 'sales'
          ? user.id
          : lead.assigned_to;

      const { data: project, error } =
        await supabase
          .from('projects')
          .insert({
            project_id: projectId,
            lead_id: lead.id,
            salesperson_id: salespersonId,
            client_name:
              client_name || lead.client_name,
            org_name:
              org_name || lead.org_name,
            phone:
              phone || lead.phone,
            email:
              email || lead.email,
            google_business_url:
              google_business_url ||
              lead.google_business_url,
            instagram_url:
              instagram_url ||
              lead.instagram_url,
            requirements,
            specifications:
              specifications || null,
            website_expectations:
              website_expectations || null,
            full_project_amount:
              parseFloat(full_project_amount),
            advance_amount:
              parseFloat(advance_amount || 0),
            status:
              'PENDING_ADMIN_APPROVAL',
            payment_status:
              payment_status || 'PARTIAL',
            salesperson_notes:
              salesperson_notes || null
          })
          .select()
          .single();

      if (error) throw error;

      await supabase
        .from('leads')
        .update({
          status: 'CONVERTED',
          full_project_amount:
            parseFloat(full_project_amount),
          advance_amount:
            parseFloat(advance_amount || 0),
          updated_at:
            new Date().toISOString()
        })
        .eq('id', lead.id);

      await createLeadActivity({
        leadId: lead.id,
        userId: user.id,
        activityType: 'CONVERTED',
        description:
          `Lead converted. Project ${projectId} created. Amount: ₹${full_project_amount}`
      });

      await supabase
        .from('project_status_history')
        .insert({
          project_id: project.id,
          old_status: null,
          new_status:
            'PENDING_ADMIN_APPROVAL',
          changed_by: user.id
        });

      // Notify admins
      const { data: admins } =
        await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .eq('is_active', 1);

      for (const admin of admins || []) {
        await createNotification({
          userId: admin.id,
          title:
            'New Project Pending Approval',
          message:
            `Project ${projectId} (${client_name || lead.client_name}) submitted by ${user.name} is awaiting your approval.`,
          type: 'ACTION_REQUIRED',
          entityType: 'project',
          entityId: project.id,
          link:
            `/admin/projects/${project.id}`
        });
      }

      res.status(201).json({
        message:
          'Lead converted. Project submitted for Admin approval.',
        projectId,
        projectDbId: project.id
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Failed to convert lead'
      });
    }
  }
);


// ============================================================
// POST /api/leads/:id/confirm-project
// ============================================================

router.post(
  '/:id/confirm-project',
  authenticate,
  requireRole('admin', 'sales', 'manager'),
  async (req, res) => {
    try {
      const lead =
        await getLeadWithDetails(req.params.id);

      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found'
        });
      }

      const user = req.user;

      if (
        user.role === 'sales' &&
        lead.assigned_to !== user.id
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      if (lead.project_confirmed) {
        return res.status(400).json({
          error: 'Project is already confirmed'
        });
      }

      if (!lead.advance_received) {
        return res.status(400).json({
          error:
            'Cannot confirm project: Advance not received'
        });
      }

      const projectId =
        await nextProjectId();

      const salespersonId =
        user.role === 'sales'
          ? user.id
          : (lead.assigned_to || user.id);

      const { data: project, error } =
        await supabase
          .from('projects')
          .insert({
            project_id: projectId,
            lead_id: lead.id,
            salesperson_id: salespersonId,
            client_name: lead.client_name,
            org_name: lead.org_name,
            phone: lead.phone,
            email: lead.email,
            google_business_url:
              lead.google_business_url,
            instagram_url:
              lead.instagram_url,
            requirements:
              lead.requirements ||
              'Pending requirements',
            specifications: null,
            full_project_amount:
              parseFloat(lead.quoted_amount || 0),
            advance_amount:
              parseFloat(lead.advance_amount || 0),
            status:
              'PENDING_FOUNDER_ALLOCATION',
            payment_status: 'PARTIAL',
            salesperson_notes:
              lead.notes || null
          })
          .select()
          .single();

      if (error) throw error;

      await supabase
        .from('leads')
        .update({
          project_confirmed: 1,
          project_confirmed_at:
            new Date().toISOString(),
          project_confirmed_by: user.id,
          project_id: project.id,
          status: 'CONVERTED',
          updated_at:
            new Date().toISOString()
        })
        .eq('id', lead.id);

      await createLeadActivity({
        leadId: lead.id,
        userId: user.id,
        activityType:
          'PROJECT_CONFIRMED',
        description:
          `Project confirmed and sent to Founder. Project ID: ${projectId}`
      });

      await supabase
        .from('project_status_history')
        .insert({
          project_id: project.id,
          old_status: null,
          new_status:
            'PENDING_FOUNDER_ALLOCATION',
          changed_by: user.id
        });

      // Notify Admin
      const { data: admins } =
        await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .eq('is_active', 1);

      for (const admin of admins || []) {
        await createNotification({
          userId: admin.id,
          title: 'New Confirmed Project',
          message:
            `Project ${projectId} (${lead.client_name}) confirmed by ${user.name} and requires payout allocation.`,
          type: 'ACTION_REQUIRED',
          entityType: 'project',
          entityId: project.id,
          link:
            `/admin/projects/${project.id}`
        });
      }

      // Notify Managers
      const { data: managers } =
        await supabase
          .from('users')
          .select('id')
          .eq('role', 'manager')
          .eq('is_active', 1);

      for (const manager of managers || []) {
        await createNotification({
          userId: manager.id,
          title: 'New Confirmed Project',
          message:
            `Project ${projectId} (${lead.client_name}) confirmed by ${user.name}.`,
          type: 'INFO',
          entityType: 'project',
          entityId: project.id,
          link: '/projects'
        });
      }

      res.status(201).json({
        message:
          'Project confirmed and sent to Founder successfully.',
        projectId,
        projectDbId: project.id
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Failed to confirm project'
      });
    }
  }
);


// ============================================================
// DELETE /api/leads/:id
// ============================================================

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const lead =
        await getLeadWithDetails(req.params.id);

      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found'
        });
      }

      const { error } = await supabase
        .from('leads')
        .update({
          is_deleted: 1,
          updated_at:
            new Date().toISOString()
        })
        .eq('id', req.params.id);

      if (error) throw error;

      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE_LEAD',
        entityType: 'lead',
        entityId: req.params.id,
        description:
          `Lead ${lead.lead_id} soft-deleted by admin`
      });

      res.json({
        message: 'Lead deleted'
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: 'Failed to delete lead'
      });
    }
  }
);


module.exports = router;