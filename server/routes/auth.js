const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/helpers');

const router = express.Router();


// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password required'
      });
    }

    const input = username.toLowerCase().trim();

    // Find active user in Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', input)
      .eq('is_active', 1)
      .maybeSingle();

    if (error) {
      console.error('Login database error:', error);

      return res.status(500).json({
        error: 'Database error during login'
      });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials or inactive account'
      });
    }

    // Check login access
    if (user.login_access === 0) {
      return res.status(403).json({
        error: 'Login access disabled for this account.'
      });
    }

    // Check password
    const valid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      JWT_SECRET,
      {
        expiresIn: '24h'
      }
    );

    // Audit log
    try {
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN',
        entityType: 'user',
        entityId: user.id,
        description: `User ${user.name} logged in`
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
    }

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error('Login error:', err);

    res.status(500).json({
      error: 'Server error during login'
    });
  }
});


// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        username,
        role,
        phone,
        is_active,
        created_at
      `)
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error(error);

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({ user });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Server error'
    });
  }
});


// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {

    try {
      await createAuditLog({
        userId: req.user.id,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: req.user.id,
        description: `User ${req.user.name} logged out`
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
    }

    res.json({
      message: 'Logged out successfully'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Server error during logout'
    });
  }
});


// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current and new password required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters'
      });
    }

    // Get current user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error(error);

      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check current password
    const valid = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!valid) {
      return res.status(400).json({
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newHash = await bcrypt.hash(
      newPassword,
      10
    );

    // Update password in Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) {
      console.error(updateError);

      return res.status(500).json({
        error: 'Failed to update password'
      });
    }

    res.json({
      message: 'Password changed successfully'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Server error while changing password'
    });
  }
});


module.exports = router;