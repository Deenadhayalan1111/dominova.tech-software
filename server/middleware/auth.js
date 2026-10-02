const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');

const JWT_SECRET =
  process.env.JWT_SECRET || 'dominova_secret_2024_change_in_production';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('id', decoded.userId)
      .maybeSingle();

    if (error) {
      console.error('Authentication database error:', error);

      return res.status(500).json({
        error: 'Authentication database error'
      });
    }

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'User not found or inactive'
      });
    }

    req.user = user;
    next();

  } catch (err) {
    console.error('Authentication error:', err);

    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
}


function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
}


module.exports = {
  authenticate,
  requireRole,
  JWT_SECRET
};