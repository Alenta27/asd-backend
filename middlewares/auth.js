const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production");
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Role-based access control middleware
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${userRole}` 
      });
    }
    next();
  };
}

// Specific role checks
function adminCheck(req, res, next) {
  return requireRole(['admin'])(req, res, next);
}

function parentCheck(req, res, next) {
  return requireRole(['parent'])(req, res, next);
}

function teacherCheck(req, res, next) {
  return requireRole(['teacher'])(req, res, next);
}

function therapistCheck(req, res, next) {
  return requireRole(['therapist'])(req, res, next);
}

function researcherCheck(req, res, next) {
  return requireRole(['researcher'])(req, res, next);
}

// Data ownership middleware - ensures users can only access their own data
function requireOwnership(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userId = req.user.id;
  const requestedUserId = req.params.userId || req.params.id || req.body.userId;

  // Admin can access any data
  if (req.user.role === 'admin') {
    return next();
  }

  // Users can only access their own data
  if (requestedUserId && requestedUserId !== userId) {
    return res.status(403).json({ message: 'Access denied. You can only access your own data.' });
  }

  next();
}

// Resource access middleware - ensures users can only access resources they're authorized for
function requireResourceAccess(resourceType) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const userId = req.user.id;

    switch (resourceType) {
      case 'children':
        // Parents can only see their own children
        if (userRole === 'parent') {
          req.query.parentId = userId;
        }
        // Teachers can see children in their class
        else if (userRole === 'teacher') {
          req.query.teacherId = userId;
        }
        // Therapists can see their clients
        else if (userRole === 'therapist') {
          req.query.therapistId = userId;
        }
        // Researchers can only see anonymized data
        else if (userRole === 'researcher') {
          req.query.anonymized = true;
        }
        break;

      case 'appointments':
        // Parents can only see appointments for their children
        if (userRole === 'parent') {
          req.query.parentId = userId;
        }
        // Therapists can see their appointments
        else if (userRole === 'therapist') {
          req.query.therapistId = userId;
        }
        break;

      case 'reports':
        // Parents can only see reports for their children
        if (userRole === 'parent') {
          req.query.parentId = userId;
        }
        // Teachers can see reports for their students
        else if (userRole === 'teacher') {
          req.query.teacherId = userId;
        }
        // Therapists can see reports for their clients
        else if (userRole === 'therapist') {
          req.query.therapistId = userId;
        }
        // Researchers can only see anonymized reports
        else if (userRole === 'researcher') {
          req.query.anonymized = true;
        }
        break;

      case 'analytics':
        // Only researchers and admins can access analytics
        if (!['researcher', 'admin'].includes(userRole)) {
          return res.status(403).json({ message: 'Access denied. Only researchers can access analytics.' });
        }
        // Researchers can only see anonymized analytics
        if (userRole === 'researcher') {
          req.query.anonymized = true;
        }
        break;
        
      default:
        // Unknown resource type - allow access
        console.log('Unknown resource type:', resourceType);
        break;
    }

    next();
  };
}

module.exports = { 
  verifyToken, 
  requireRole,
  adminCheck, 
  parentCheck,
  teacherCheck,
  therapistCheck,
  researcherCheck,
  requireOwnership,
  requireResourceAccess
};
