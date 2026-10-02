const express = require('express');
const supabase = require('../db/supabase');

const {
  authenticate,
  requireRole
} = require('../middleware/auth');

const {
  createAuditLog,
  createNotification,
  recordProjectStatusChange,
  creditWallet
} = require('../middleware/helpers');

const router = express.Router();


// ============================================================
// HELPERS
// ============================================================

async function getProjectDetail(id) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', 0)
    .maybeSingle();

  if (error) throw error;
  if (!project) return null;

  let salesperson = null;
  let developer = null;
  let approvedBy = null;
  let lead = null;

  if (project.salesperson_id) {
    const { data } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', project.salesperson_id)
      .maybeSingle();

    salesperson = data;
  }

  if (project.developer_id) {
    const { data } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', project.developer_id)
      .maybeSingle();

    developer = data;
  }

  if (project.approved_by) {
    const { data } = await supabase
      .from('users')
      .select('name')
      .eq('id', project.approved_by)
      .maybeSingle();

    approvedBy = data;
  }

  if (project.lead_id) {
    const { data } = await supabase
      .from('leads')
      .select('lead_id')
      .eq('id', project.lead_id)
      .maybeSingle();

    lead = data;
  }

  return {
    ...project,
    salesperson_name: salesperson?.name || null,
    salesperson_email: salesperson?.email || null,
    developer_name: developer?.name || null,
    developer_email: developer?.email || null,
    approved_by_name: approvedBy?.name || null,
    lead_id_display: lead?.lead_id || null
  };
}


async function getUsersByRole(role) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', role)
    .eq('is_active', 1);

  if (error) throw error;

  return data || [];
}


async function addStatusHistory(
  projectId,
  oldStatus,
  newStatus,
  changedBy,
  notes = null
) {
  return recordProjectStatusChange({
    projectId,
    oldStatus,
    newStatus,
    changedBy,
    notes
  });
}


// ============================================================
// GET /api/projects
// ============================================================

router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;

    const {
      status,
      developer_id,
      salesperson_id,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit) || 50, 1),
      100
    );

    const offset = (pageNumber - 1) * limitNumber;

    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('is_deleted', 0);

    // Salesperson sees own projects
    if (user.role === 'sales') {
      query = query.eq('salesperson_id', user.id);
    }

    // Developer sees assigned projects and available projects
    if (user.role === 'developer') {
      query = query.or(
        `developer_id.eq.${user.id},` +
        `frontend_developer_id.eq.${user.id},` +
        `backend_developer_id.eq.${user.id},` +
        `hosting_developer_id.eq.${user.id},` +
        `status.eq.AVAILABLE_FOR_DEVELOPER,` +
        `status.eq.AVAILABLE_FOR_DEVELOPERS`
      );
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (
      developer_id &&
      user.role === 'admin'
    ) {
      query = query.eq(
        'developer_id',
        developer_id
      );
    }

    if (
      salesperson_id &&
      user.role === 'admin'
    ) {
      query = query.eq(
        'salesperson_id',
        salesperson_id
      );
    }

    if (search) {
      query = query.or(
        `client_name.ilike.%${search}%,` +
        `org_name.ilike.%${search}%,` +
        `phone.ilike.%${search}%,` +
        `project_id.ilike.%${search}%`
      );
    }

    const {
      data: projects,
      error,
      count
    } = await query
      .order('created_at', {
        ascending: false
      })
      .range(
        offset,
        offset + limitNumber - 1
      );

    if (error) throw error;

    const enrichedProjects =
      await Promise.all(
        (projects || []).map(async project => {
          const result =
            await getProjectDetail(project.id);

          if (user.role === 'developer') {
            delete result.full_project_amount;
            delete result.advance_amount;
            delete result.remaining_amount;
          }

          return result;
        })
      );

    res.json({
      projects: enrichedProjects,
      total: count || 0
    });

  } catch (err) {
    console.error(
      'GET PROJECTS ERROR:',
      err
    );

    res.status(500).json({
      error: 'Failed to fetch projects'
    });
  }
});


// ============================================================
// GET /api/projects/stats
// ============================================================

router.get(
  '/stats',
  authenticate,
  async (req, res) => {
    try {
      const user = req.user;

      let baseQuery = supabase
        .from('projects')
        .select(
          'id, status, full_project_amount, advance_amount'
        )
        .eq('is_deleted', 0);

      if (user.role === 'sales') {
        baseQuery = baseQuery.eq(
          'salesperson_id',
          user.id
        );
      }

      if (user.role === 'developer') {
        baseQuery = baseQuery.eq(
          'developer_id',
          user.id
        );
      }

      const {
        data: projects,
        error
      } = await baseQuery;

      if (error) throw error;

      const rows = projects || [];

      const countStatus = status =>
        rows.filter(
          p => p.status === status
        ).length;

      const sum = field =>
        rows.reduce(
          (total, p) =>
            total +
            Number(p[field] || 0),
          0
        );

      res.json({
        pending_admin_approval:
          countStatus(
            'PENDING_ADMIN_APPROVAL'
          ),

        pending_founder_allocation:
          countStatus(
            'PENDING_FOUNDER_ALLOCATION'
          ),

        available_for_developer:
          countStatus(
            'AVAILABLE_FOR_DEVELOPER'
          ) +
          countStatus(
            'AVAILABLE_FOR_DEVELOPERS'
          ),

        assigned:
          countStatus('ASSIGNED'),

        in_development:
          countStatus('IN_DEVELOPMENT'),

        pending_final_approval:
          countStatus(
            'PENDING_FINAL_APPROVAL'
          ),

        revision_required:
          countStatus(
            'REVISION_REQUIRED'
          ),

        completed:
          countStatus('COMPLETED'),

        total: rows.length,

        total_revenue:
          sum('full_project_amount'),

        total_advance:
          sum('advance_amount')
      });

    } catch (err) {
      console.error(
        'PROJECT STATS ERROR:',
        err
      );

      res.status(500).json({
        error: 'Failed to fetch project statistics'
      });
    }
  }
);


// ============================================================
// GET /api/projects/:id
// ============================================================

router.get(
  '/:id',
  authenticate,
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      const user = req.user;

      if (
        user.role === 'sales' &&
        project.salesperson_id !== user.id
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      if (
        user.role === 'developer' &&
        project.developer_id !== user.id &&
        project.frontend_developer_id !== user.id &&
        project.backend_developer_id !== user.id &&
        project.hosting_developer_id !== user.id &&
        project.status !==
          'AVAILABLE_FOR_DEVELOPER' &&
        project.status !==
          'AVAILABLE_FOR_DEVELOPERS'
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      const {
        data: statusHistory,
        error: historyError
      } = await supabase
        .from('project_status_history')
        .select('*')
        .eq(
          'project_id',
          project.id
        )
        .order('created_at', {
          ascending: true
        });

      if (historyError) throw historyError;

      const enrichedHistory =
        await Promise.all(
          (statusHistory || []).map(
            async item => {
              const { data: user } =
                await supabase
                  .from('users')
                  .select('name')
                  .eq(
                    'id',
                    item.changed_by
                  )
                  .maybeSingle();

              return {
                ...item,
                changed_by_name:
                  user?.name || null
              };
            }
          )
        );

      const {
        data: messages,
        error: messageError
      } = await supabase
        .from('project_messages')
        .select('*')
        .eq(
          'project_id',
          project.id
        )
        .order('created_at', {
          ascending: true
        });

      if (messageError) throw messageError;

      const enrichedMessages =
        await Promise.all(
          (messages || []).map(
            async message => {
              const { data: sender } =
                await supabase
                  .from('users')
                  .select('name, role')
                  .eq(
                    'id',
                    message.sender_id
                  )
                  .maybeSingle();

              return {
                ...message,
                sender_name:
                  sender?.name || null,
                sender_role:
                  sender?.role || null
              };
            }
          )
        );

      const {
        data: files,
        error: fileError
      } = await supabase
        .from('project_files')
        .select('*')
        .eq(
          'project_id',
          project.id
        )
        .eq('is_deleted', 0)
        .order('created_at', {
          ascending: false
        });

      if (fileError) throw fileError;

      const enrichedFiles =
        await Promise.all(
          (files || []).map(
            async file => {
              const { data: uploader } =
                await supabase
                  .from('users')
                  .select('name')
                  .eq(
                    'id',
                    file.uploaded_by
                  )
                  .maybeSingle();

              return {
                ...file,
                uploaded_by_name:
                  uploader?.name || null
              };
            }
          )
        );

      const {
        data: revisions,
        error: revisionError
      } = await supabase
        .from('project_revisions')
        .select('*')
        .eq(
          'project_id',
          project.id
        )
        .order('revision_number', {
          ascending: true
        });

      if (revisionError) throw revisionError;

      const enrichedRevisions =
        await Promise.all(
          (revisions || []).map(
            async revision => {
              const { data: rejecter } =
                await supabase
                  .from('users')
                  .select('name')
                  .eq(
                    'id',
                    revision.rejected_by
                  )
                  .maybeSingle();

              return {
                ...revision,
                rejected_by_name:
                  rejecter?.name || null
              };
            }
          )
        );

      if (user.role === 'developer') {
        delete project.full_project_amount;
        delete project.advance_amount;
        delete project.remaining_amount;
      }

      res.json({
        project,
        statusHistory:
          enrichedHistory,
        messages:
          enrichedMessages,
        files:
          enrichedFiles,
        revisions:
          enrichedRevisions
      });

    } catch (err) {
      console.error(
        'GET PROJECT ERROR:',
        err
      );

      res.status(500).json({
        error: 'Failed to fetch project'
      });
    }
  }
);


// ============================================================
// POST /api/projects/:id/approve
// ============================================================

router.post(
  '/:id/approve',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      if (
        project.status !==
          'PENDING_ADMIN_APPROVAL' &&
        project.status !==
          'PENDING_FOUNDER_ALLOCATION'
      ) {
        return res.status(400).json({
          error:
            'Project is not pending admin approval or allocation'
        });
      }

      const {
        developer_payout,
        backend_payout,
        hosting_payout,
        admin_approval_notes,
        deadline
      } = req.body;

      if (!developer_payout) {
        return res.status(400).json({
          error:
            'developer_payout (frontend) is required when approving'
        });
      }

      if (!deadline) {
        return res.status(400).json({
          error:
            'deadline is required when approving'
        });
      }

      const { error } =
        await supabase
          .from('projects')
          .update({
            status:
              'AVAILABLE_FOR_DEVELOPERS',

            developer_payout:
              parseFloat(
                developer_payout
              ),

            backend_payout:
              parseFloat(
                backend_payout || 0
              ),

            hosting_payout:
              parseFloat(
                hosting_payout || 0
              ),

            admin_approval_notes:
              admin_approval_notes ||
              null,

            deadline,

            updated_at:
              new Date().toISOString()
          })
          .eq('id', project.id);

      if (error) throw error;

      await addStatusHistory(
        project.id,
        project.status,
        'AVAILABLE_FOR_DEVELOPERS',
        req.user.id,
        admin_approval_notes ||
          'Admin approved and allocated payouts'
      );

      if (project.salesperson_id) {
        await createNotification({
          userId:
            project.salesperson_id,

          title:
            'Project Approved!',

          message:
            `Your project ${project.project_id} (${project.client_name}) has been approved by admin.`,

          type:
            'SUCCESS',

          entityType:
            'project',

          entityId:
            project.id,

          link:
            `/sales/projects/${project.id}`
        });
      }

      const developers =
        await getUsersByRole(
          'developer'
        );

      for (
        const developer of developers
      ) {
        await createNotification({
          userId:
            developer.id,

          title:
            'New Project Available',

          message:
            `A new project (${project.project_id} - ${project.client_name}) is available for developers.`,

          type:
            'ACTION_REQUIRED',

          entityType:
            'project',

          entityId:
            project.id,

          link:
            '/developer/projects'
        });
      }

      await createAuditLog({
        userId:
          req.user.id,

        action:
          'APPROVE_PROJECT',

        entityType:
          'project',

        entityId:
          project.id,

        description:
          `Admin approved project ${project.project_id}. Dev payout: ₹${developer_payout}`
      });

      res.json({
        message:
          'Project approved and made available for developers'
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to approve project'
      });
    }
  }
);


// ============================================================
// POST /api/projects/:id/reject
// ============================================================

router.post(
  '/:id/reject',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      if (
        project.status !==
        'PENDING_ADMIN_APPROVAL'
      ) {
        return res.status(400).json({
          error:
            'Project is not pending admin approval'
        });
      }

      const {
        rejection_reason
      } = req.body;

      if (
        !rejection_reason ||
        !rejection_reason.trim()
      ) {
        return res.status(400).json({
          error:
            'Rejection reason is required'
        });
      }

      const { error } =
        await supabase
          .from('projects')
          .update({
            status:
              'REJECTED_BY_ADMIN',

            rejection_reason:
              rejection_reason.trim(),

            updated_at:
              new Date().toISOString()
          })
          .eq('id', project.id);

      if (error) throw error;

      await addStatusHistory(
        project.id,
        project.status,
        'REJECTED_BY_ADMIN',
        req.user.id,
        rejection_reason
      );

      if (project.salesperson_id) {
        await createNotification({
          userId:
            project.salesperson_id,

          title:
            'Project Returned by Admin',

          message:
            `Project ${project.project_id} has been returned. Reason: ${rejection_reason}`,

          type:
            'WARNING',

          entityType:
            'project',

          entityId:
            project.id,

          link:
            `/sales/projects/${project.id}`
        });
      }

      res.json({
        message:
          'Project rejected and returned to sales'
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to reject project'
      });
    }
  }
);


// ============================================================
// POST /api/projects/:id/accept
// ============================================================

router.post(
  '/:id/accept',
  authenticate,
  requireRole('developer'),
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      if (
        project.status !==
          'AVAILABLE_FOR_DEVELOPER' &&
        project.status !==
          'AVAILABLE_FOR_DEVELOPERS'
      ) {
        return res.status(400).json({
          error:
            'Project is no longer available'
        });
      }

      // Check active project
      const { data: activeProjects,
        error: activeError } =
        await supabase
          .from('projects')
          .select('id')
          .eq('is_deleted', 0)
          .in('status', [
            'ASSIGNED',
            'IN_DEVELOPMENT',
            'TESTING',
            'SUBMITTED',
            'PENDING_FINAL_APPROVAL',
            'REVISION_REQUIRED'
          ])
          .or(
            `developer_id.eq.${req.user.id},` +
            `frontend_developer_id.eq.${req.user.id},` +
            `backend_developer_id.eq.${req.user.id},` +
            `hosting_developer_id.eq.${req.user.id}`
          );

      if (activeError) throw activeError;

      const otherActive =
        (activeProjects || [])
          .find(
            p => p.id !== project.id
          );

      if (otherActive) {
        return res.status(400).json({
          error:
            'You already have an active project. Complete it before accepting another.'
        });
      }

      const {
        picked_components
      } = req.body;

      if (
        !Array.isArray(
          picked_components
        ) ||
        picked_components.length === 0
      ) {
        return res.status(400).json({
          error:
            'No valid components picked'
        });
      }

      const updates = {};

      if (
        picked_components.includes(
          'frontend'
        )
      ) {
        if (
          project.frontend_developer_id
        ) {
          return res.status(400).json({
            error:
              'Frontend already claimed'
          });
        }

        updates.frontend_developer_id =
          req.user.id;
      }

      if (
        picked_components.includes(
          'backend'
        )
      ) {
        if (
          project.backend_developer_id
        ) {
          return res.status(400).json({
            error:
              'Backend already claimed'
          });
        }

        updates.backend_developer_id =
          req.user.id;
      }

      if (
        picked_components.includes(
          'hosting'
        )
      ) {
        if (
          project.hosting_developer_id
        ) {
          return res.status(400).json({
            error:
              'Hosting already claimed'
          });
        }

        updates.hosting_developer_id =
          req.user.id;
      }

      if (
        Object.keys(updates).length === 0
      ) {
        return res.status(400).json({
          error:
            'No valid components picked'
        });
      }

      const frontendClaimed =
        project.frontend_developer_id ||
        picked_components.includes(
          'frontend'
        );

      const backendClaimed =
        project.backend_developer_id ||
        picked_components.includes(
          'backend'
        );

      const hostingClaimed =
        project.hosting_developer_id ||
        picked_components.includes(
          'hosting'
        );

      let fullyClaimed = true;

      if (
        Number(project.developer_payout || 0) >
          0 &&
        !frontendClaimed
      ) {
        fullyClaimed = false;
      }

      if (
        Number(project.backend_payout || 0) >
          0 &&
        !backendClaimed
      ) {
        fullyClaimed = false;
      }

      if (
        Number(project.hosting_payout || 0) >
          0 &&
        !hostingClaimed
      ) {
        fullyClaimed = false;
      }

      if (fullyClaimed) {
        updates.status =
          'ASSIGNED';
      }

      if (!project.developer_id) {
        updates.developer_id =
          req.user.id;
      }

      updates.updated_at =
        new Date().toISOString();

      const { error: updateError } =
        await supabase
          .from('projects')
          .update(updates)
          .eq('id', project.id)
          .in('status', [
            'AVAILABLE_FOR_DEVELOPER',
            'AVAILABLE_FOR_DEVELOPERS'
          ]);

      if (updateError) throw updateError;

      if (
        fullyClaimed &&
        project.status !== 'ASSIGNED'
      ) {
        await addStatusHistory(
          project.id,
          project.status,
          'ASSIGNED',
          req.user.id,
          'Project fully claimed and ASSIGNED.'
        );
      }

      const admins =
        await getUsersByRole('admin');

      for (const admin of admins) {
        await createNotification({
          userId:
            admin.id,

          title:
            'Developer Accepted Project',

          message:
            `${req.user.name} has accepted project ${project.project_id} (${project.client_name}).`,

          type:
            'INFO',

          entityType:
            'project',

          entityId:
            project.id,

          link:
            `/admin/projects/${project.id}`
        });
      }

      await createAuditLog({
        userId:
          req.user.id,

        action:
          'ACCEPT_PROJECT',

        entityType:
          'project',

        entityId:
          project.id,

        description:
          `Developer ${req.user.name} accepted project ${project.project_id}`
      });

      res.json({
        message:
          'Project accepted successfully',

        projectId:
          project.project_id
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to accept project'
      });
    }
  }
);


// ============================================================
// PUT /api/projects/:id/status
// ============================================================

router.put(
  '/:id/status',
  authenticate,
  requireRole(
    'developer',
    'admin'
  ),
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      if (
        req.user.role === 'developer' &&
        project.developer_id !==
          req.user.id
      ) {
        return res.status(403).json({
          error:
            'Access denied — not your project'
        });
      }

      const {
        status,
        notes
      } = req.body;

      const devStatuses = [
        'IN_DEVELOPMENT',
        'TESTING'
      ];

      if (
        !status ||
        !devStatuses.includes(status)
      ) {
        return res.status(400).json({
          error:
            `Status must be one of: ${devStatuses.join(', ')}`
        });
      }

      const { error } =
        await supabase
          .from('projects')
          .update({
            status,
            updated_at:
              new Date().toISOString()
          })
          .eq('id', project.id);

      if (error) throw error;

      await addStatusHistory(
        project.id,
        project.status,
        status,
        req.user.id,
        notes || null
      );

      res.json({
        message:
          'Development status updated'
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to update development status'
      });
    }
  }
);


// ============================================================
// POST /api/projects/:id/submit
// ============================================================

router.post(
  '/:id/submit',
  authenticate,
  requireRole('developer'),
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      if (
        project.developer_id !==
        req.user.id
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      const validForSubmit = [
        'ASSIGNED',
        'IN_DEVELOPMENT',
        'TESTING',
        'REVISION_REQUIRED'
      ];

      if (
        !validForSubmit.includes(
          project.status
        )
      ) {
        return res.status(400).json({
          error:
            'Project cannot be submitted in current status'
        });
      }

      const {
        final_website_url,
        notes
      } = req.body;

      if (
        !final_website_url ||
        !final_website_url.trim()
      ) {
        return res.status(400).json({
          error:
            'final_website_url is required'
        });
      }

      const { error } =
        await supabase
          .from('projects')
          .update({
            final_website_url:
              final_website_url.trim(),

            status:
              'PENDING_FINAL_APPROVAL',

            updated_at:
              new Date().toISOString()
          })
          .eq('id', project.id);

      if (error) throw error;

      await addStatusHistory(
        project.id,
        project.status,
        'PENDING_FINAL_APPROVAL',
        req.user.id,
        notes ||
          `Developer submitted website: ${final_website_url}`
      );

      const admins =
        await getUsersByRole('admin');

      for (const admin of admins) {
        await createNotification({
          userId:
            admin.id,

          title:
            'Website Submitted for Review',

          message:
            `${req.user.name} has submitted project ${project.project_id} (${project.client_name}) for final approval.`,

          type:
            'ACTION_REQUIRED',

          entityType:
            'project',

          entityId:
            project.id,

          link:
            `/admin/projects/${project.id}`
        });
      }

      await createAuditLog({
        userId:
          req.user.id,

        action:
          'SUBMIT_PROJECT',

        entityType:
          'project',

        entityId:
          project.id,

        description:
          `Developer submitted project ${project.project_id}. URL: ${final_website_url}`
      });

      res.json({
        message:
          'Project submitted for final admin approval'
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to submit project'
      });
    }
  }
);


// ============================================================
// POST /api/projects/:id/final-approve
// ============================================================

router.post(
  '/:id/final-approve',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      if (
        project.status !==
        'PENDING_FINAL_APPROVAL'
      ) {
        return res.status(400).json({
          error:
            'Project is not pending final approval'
        });
      }

      if (!project.developer_id) {
        return res.status(400).json({
          error:
            'Project has no developer assigned'
        });
      }

      const {
        admin_notes,
        sales_commission
      } = req.body;

      const commission =
        sales_commission
          ? parseFloat(
              sales_commission
            )
          : null;

      const { error: updateError } =
        await supabase
          .from('projects')
          .update({
            status:
              'COMPLETED',

            approved_by:
              req.user.id,

            approved_at:
              new Date().toISOString(),

            completed_at:
              new Date().toISOString(),

            admin_approval_notes:
              admin_notes || null,

            sales_commission:
              commission,

            updated_at:
              new Date().toISOString()
          })
          .eq('id', project.id);

      if (updateError) {
        throw updateError;
      }

      await addStatusHistory(
        project.id,
        'PENDING_FINAL_APPROVAL',
        'COMPLETED',
        req.user.id,
        admin_notes ||
          'Admin approved final delivery'
      );

      // ======================================================
      // Calculate developer payouts
      // ======================================================

      const developers = [
        {
          id:
            project.frontend_developer_id,
          payout:
            Number(
              project.developer_payout || 0
            )
        },
        {
          id:
            project.backend_developer_id,
          payout:
            Number(
              project.backend_payout || 0
            )
        },
        {
          id:
            project.hosting_developer_id,
          payout:
            Number(
              project.hosting_payout || 0
            )
        }
      ];

      const uniqueDevs = {};

      for (
        const developer of developers
      ) {
        if (
          developer.id &&
          developer.payout > 0
        ) {
          uniqueDevs[
            developer.id
          ] =
            (
              uniqueDevs[
                developer.id
              ] || 0
            ) +
            developer.payout;
        }
      }

      // Legacy fallback
      if (
        Object.keys(
          uniqueDevs
        ).length === 0
      ) {
        uniqueDevs[
          project.developer_id
        ] =
          Number(
            project.developer_payout || 0
          );
      }

      let totalPayout = 0;

      for (
        const [devId, payout]
        of Object.entries(
          uniqueDevs
        )
      ) {
        totalPayout += payout;

        await creditWallet({
          userId:
            devId,

          projectId:
            project.id,

          amount:
            payout,

          type:
            'DEVELOPER_EARNING',

          description:
            `Project completion payout - ${project.project_id} (${project.client_name})`,

          createdBy:
            req.user.id
        });

        await createNotification({
          userId:
            devId,

          title:
            'Project Approved & Payment Credited!',

          message:
            `Project ${project.project_id} approved! ₹${payout} has been credited to your wallet.`,

          type:
            'SUCCESS',

          entityType:
            'project',

          entityId:
            project.id,

          link:
            '/developer/wallet'
        });
      }

      // ======================================================
      // Sales commission
      // ======================================================

      if (
        commission &&
        commission > 0 &&
        project.salesperson_id
      ) {
        await creditWallet({
          userId:
            project.salesperson_id,

          projectId:
            project.id,

          amount:
            commission,

          type:
            'SALES_COMMISSION',

          description:
            `Sales commission - ${project.project_id} (${project.client_name})`,

          createdBy:
            req.user.id
        });

        await createNotification({
          userId:
            project.salesperson_id,

          title:
            'Commission Credited!',

          message:
            `₹${commission} commission credited to your wallet for project ${project.project_id}.`,

          type:
            'SUCCESS',

          entityType:
            'project',

          entityId:
            project.id,

          link:
            '/sales/wallet'
        });
      }

      await createAuditLog({
        userId:
          req.user.id,

        action:
          'FINAL_APPROVE_PROJECT',

        entityType:
          'project',

        entityId:
          project.id,

        description:
          `Admin final approval for ${project.project_id}. Developer payout: ₹${totalPayout}.`
      });

      res.json({
        message:
          `Project completed. Developer wallet credited ₹${totalPayout}.`
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to final approve project'
      });
    }
  }
);


// ============================================================
// POST /api/projects/:id/final-reject
// ============================================================

router.post(
  '/:id/final-reject',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      if (
        project.status !==
        'PENDING_FINAL_APPROVAL'
      ) {
        return res.status(400).json({
          error:
            'Project is not pending final approval'
        });
      }

      const {
        rejection_reason
      } = req.body;

      if (
        !rejection_reason ||
        !rejection_reason.trim()
      ) {
        return res.status(400).json({
          error:
            'Rejection reason is required'
        });
      }

      const newRevisionNumber =
        Number(
          project.revision_count || 0
        ) + 1;

      const { error: updateError } =
        await supabase
          .from('projects')
          .update({
            status:
              'REVISION_REQUIRED',

            final_rejection_reason:
              rejection_reason.trim(),

            revision_count:
              newRevisionNumber,

            updated_at:
              new Date().toISOString()
          })
          .eq('id', project.id);

      if (updateError) {
        throw updateError;
      }

      const {
        error: revisionError
      } = await supabase
        .from('project_revisions')
        .insert({
          project_id:
            project.id,

          revision_number:
            newRevisionNumber,

          rejection_reason:
            rejection_reason.trim(),

          rejected_by:
            req.user.id
        });

      if (revisionError) {
        throw revisionError;
      }

      await addStatusHistory(
        project.id,
        'PENDING_FINAL_APPROVAL',
        'REVISION_REQUIRED',
        req.user.id,
        rejection_reason
      );

      if (project.developer_id) {
        await createNotification({
          userId:
            project.developer_id,

          title:
            'Revision Requested',

          message:
            `Admin has requested changes on ${project.project_id}: ${rejection_reason}`,

          type:
            'WARNING',

          entityType:
            'project',

          entityId:
            project.id,

          link:
            '/developer/my-project'
        });
      }

      res.json({
        message:
          'Revision requested. Developer notified.'
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to request revision'
      });
    }
  }
);


// ============================================================
// POST /api/projects/:id/message
// ============================================================

router.post(
  '/:id/message',
  authenticate,
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      const user = req.user;

      if (
        user.role === 'sales' &&
        project.salesperson_id !==
          user.id
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      if (
        user.role === 'developer' &&
        project.developer_id !==
          user.id
      ) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      const { message } = req.body;

      if (
        !message ||
        !message.trim()
      ) {
        return res.status(400).json({
          error:
            'Message cannot be empty'
        });
      }

      const {
        data: newMessage,
        error
      } = await supabase
        .from('project_messages')
        .insert({
          project_id:
            project.id,

          sender_id:
            user.id,

          message:
            message.trim()
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        message: {
          ...newMessage,

          sender_name:
            user.name,

          sender_role:
            user.role
        }
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to send message'
      });
    }
  }
);


// ============================================================
// PUT /api/projects/:id
// ============================================================

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const project =
        await getProjectDetail(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      const allowed = [
        'client_name',
        'org_name',
        'phone',
        'email',
        'google_business_url',
        'instagram_url',
        'requirements',
        'specifications',
        'website_expectations',
        'full_project_amount',
        'advance_amount',
        'developer_payout',
        'sales_commission',
        'payment_status',
        'admin_approval_notes'
      ];

      const updates = {};

      for (
        const key of allowed
      ) {
        if (
          req.body[key] !== undefined
        ) {
          updates[key] =
            req.body[key];
        }
      }

      if (
        Object.keys(updates).length === 0
      ) {
        return res.status(400).json({
          error:
            'Nothing to update'
        });
      }

      updates.updated_at =
        new Date().toISOString();

      const { error } =
        await supabase
          .from('projects')
          .update(updates)
          .eq('id', project.id);

      if (error) throw error;

      res.json({
        message:
          'Project updated'
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          'Failed to update project'
      });
    }
  }
);


module.exports = router;