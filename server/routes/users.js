const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/helpers');

const router = express.Router();

// All user management routes require admin (Founder) access
router.use(authenticate);
router.use(requireRole('admin'));

// GET /api/users - List all employees
router.get('/', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        username,
        role,
        domain,
        employee_id,
        login_access,
        joining_date,
        phone,
        is_active,
        created_at,
        avatar_url
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// GET /api/users/:id - Get specific employee
router.get('/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        username,
        role,
        domain,
        employee_id,
        login_access,
        joining_date,
        phone,
        is_active,
        created_at,
        avatar_url
      `)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// POST /api/users - Create new employee
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      avatar_url,
      role,
      domain,
      employee_id,
      joining_date,
      login_access,
      username,
      password
    } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        error: 'Name, email, and role are required'
      });
    }

    // Founder cannot create another Founder
    if (role === 'admin') {
      return res.status(403).json({
        error: 'Cannot create additional Founder accounts'
      });
    }

    // Check email
    const { data: existingEmail, error: emailError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (emailError) {
      console.error(emailError);
      return res.status(500).json({
        error: 'Database error while checking email'
      });
    }

    if (existingEmail) {
      return res.status(400).json({
        error: 'Email already exists'
      });
    }

    // Check username
    if (username) {
      const { data: existingUsername, error: usernameError } =
        await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .maybeSingle();

      if (usernameError) {
        console.error(usernameError);
        return res.status(500).json({
          error: 'Database error while checking username'
        });
      }

      if (existingUsername) {
        return res.status(400).json({
          error: 'Username already exists. Please choose another username.'
        });
      }
    }

    // Password
    let hash = 'no-login-access';

    if (login_access === 1) {
      if (!password || !username) {
        return res.status(400).json({
          error:
            'Username and password are required when login access is enabled'
        });
      }

      hash = await bcrypt.hash(password, 10);
    }

    // Insert user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        name,
        email,
        phone: phone || null,
        avatar_url: avatar_url || null,
        role,
        domain: domain || null,
        employee_id: employee_id || null,
        joining_date: joining_date || null,
        login_access: login_access === 1 ? 1 : 0,
        username: username || null,
        password_hash: hash
      })
      .select('id')
      .single();

    if (insertError) {
      console.error(insertError);

      return res.status(500).json({
        error: 'Database error while creating employee'
      });
    }

    // Audit log
    try {
      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE_EMPLOYEE',
        entityType: 'user',
        entityId: newUser.id,
        description: `Created new employee: ${name} (${role})`
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
    }

    res.status(201).json({
      message: 'Employee created successfully',
      id: newUser.id
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Server error while creating employee'
    });
  }
});


// PUT /api/users/:id - Update employee
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      phone,
      avatar_url,
      role,
      domain,
      employee_id,
      joining_date,
      login_access,
      is_active
    } = req.body;

    // Check user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (userError) {
      console.error(userError);
      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Protect Founder account
    if (parseInt(req.params.id) === 1) {
      if (role && role !== 'admin') {
        return res.status(403).json({
          error: 'Cannot change Founder role'
        });
      }

      if (is_active !== undefined && is_active === 0) {
        return res.status(403).json({
          error: 'Cannot deactivate Founder'
        });
      }
    } else if (role === 'admin') {
      return res.status(403).json({
        error: 'Cannot promote to Founder'
      });
    }

    // Build update object
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (role !== undefined) updates.role = role;
    if (domain !== undefined) updates.domain = domain;
    if (employee_id !== undefined) updates.employee_id = employee_id;
    if (joining_date !== undefined) updates.joining_date = joining_date;

    if (login_access !== undefined) {
      updates.login_access = login_access ? 1 : 0;
    }

    if (is_active !== undefined) {
      updates.is_active = is_active ? 1 : 0;
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id);

    if (updateError) {
      console.error(updateError);

      return res.status(500).json({
        error: 'Database error while updating employee'
      });
    }

    // Audit log
    try {
      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE_EMPLOYEE',
        entityType: 'user',
        entityId: req.params.id,
        description: `Updated employee details for ID ${req.params.id}`
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
    }

    res.json({
      message: 'Employee updated successfully'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Server error while updating employee'
    });
  }
});


module.exports = router;