const jwt = require('jsonwebtoken');

/** Auth from JWT only — role/id are already in the token (no DB round-trip per request). */
const protect = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded?.id || !decoded?.role) {
        return res.status(401).json({ message: 'Not authorized, token invalid' });
      }
      req.user = { id: decoded.id, role: decoded.role };
      return next();
    } catch {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  return res.status(401).json({ message: 'Not authorized, no token' });
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

const opsOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'ops')) return next();
  return res.status(403).json({ message: 'Ops or admin access required' });
};

/** Attach user if Bearer token present; never fail the request. */
const optionalProtect = (req, _res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id && decoded?.role) {
        req.user = { id: decoded.id, role: decoded.role };
      }
    } catch {
      /* ignore invalid token */
    }
  }
  return next();
};

module.exports = { protect, adminOnly, opsOrAdmin, optionalProtect };
