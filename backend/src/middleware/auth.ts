import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  orgId?: string;
  userRole?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('[Auth] JWT_SECRET environment variable is not set');
    res.status(500).json({ error: 'Server authentication configuration error' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      orgId?: string;
      role?: string;
    };
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.orgId = decoded.orgId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      console.error('[Auth] Token expired for request to', req.path);
      res.status(401).json({ error: 'Token expired' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      console.error('[Auth] Invalid token for request to', req.path, ':', err.message);
      res.status(401).json({ error: 'Invalid token' });
    } else {
      console.error('[Auth] Unexpected token verification error:', err instanceof Error ? err.message : err);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}

export function requireSuperadmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.userRole !== 'superadmin') {
    console.error(`[Auth] Superadmin access denied for user ${req.userId} (role: ${req.userRole}) on ${req.path}`);
    res.status(403).json({ error: 'Superadmin access required' });
    return;
  }
  next();
}
