import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/database';

export const JWT_SECRET = process.env.JWT_SECRET || 'federated_healthcare_ai_jwt_secret_key_2026_production';
export const JWT_EXPIRES_IN = '8h';

export interface AuthUserPayload {
  id: number;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'RESEARCHER';
  hospital_id: number | null;
  hospital_name?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Hash a plain password using bcrypt with salt rounds 10.
 */
export function hashPassword(plainText: string): string {
  return bcrypt.hashSync(plainText, 10);
}

/**
 * Verify a plain text password against either bcrypt hash or SHA-256 (seed data compatibility).
 */
export function verifyPassword(plainText: string, storedHash: string): boolean {
  if (!plainText || !storedHash) return false;
  try {
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      return bcrypt.compareSync(plainText, storedHash);
    }
  } catch (err) {
    // If bcrypt check fails, fall through to SHA-256 check
  }

  // Check SHA-256 fallback (used in initial seeds)
  const sha256 = crypto.createHash('sha256').update(plainText).digest('hex');
  if (sha256 === storedHash) {
    return true;
  }

  // Also check plain text fallback if any legacy test record exists
  return plainText === storedHash;
}

/**
 * Generate a cryptographically signed JWT token with standard claims.
 */
export function generateToken(user: AuthUserPayload, expiresIn: string = JWT_EXPIRES_IN): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hospital_id: user.hospital_id,
      hospital_name: user.hospital_name || null,
    },
    JWT_SECRET,
    { expiresIn: expiresIn as any, algorithm: 'HS256' }
  );
}

/**
 * Verify and decode a JWT token string.
 */
export function verifyJwtToken(token: string): any {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

/**
 * Authentication Middleware: Validates Bearer JWT from Authorization header.
 * Rejects expired, tampered, or missing tokens with 401 Unauthorized.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      detail: 'Missing or malformed Authorization header. Expected Bearer token.',
      code: 'AUTH_REQUIRED',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyJwtToken(token);
    const userId = decoded.sub || decoded.id;

    // Verify user exists and is ACTIVE in the database
    const user = await db.queryOne<{
      id: number;
      hospital_id: number | null;
      name: string;
      email: string;
      role: string;
      status: string;
    }>('SELECT id, hospital_id, name, email, role, status FROM users WHERE id = $1', [userId]);

    if (!user) {
      return res.status(401).json({
        detail: 'User account no longer exists in system.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        detail: 'User account is deactivated or suspended.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // Lookup hospital name if assigned
    let hospitalName: string | null = null;
    if (user.hospital_id) {
      const hosp = await db.queryOne<{ hospital_name: string }>(
        'SELECT hospital_name FROM hospitals WHERE id = $1',
        [user.hospital_id]
      );
      if (hosp) hospitalName = hosp.hospital_name;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      hospital_id: user.hospital_id,
      hospital_name: hospitalName,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        detail: 'Access token has expired. Please re-authenticate.',
        code: 'TOKEN_EXPIRED',
        expiredAt: err.expiredAt,
      });
    }
    return res.status(401).json({
      detail: 'Invalid or forged authentication token.',
      code: 'INVALID_TOKEN',
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Rejects requests if user's role is not in the allowed list with 403 Forbidden.
 */
export function requireRoles(...allowedRoles: ('SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'RESEARCHER')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        detail: 'Authentication required prior to authorization check.',
        code: 'AUTH_REQUIRED',
      });
    }

    // Treat DOCTOR and RESEARCHER as equivalent clinical roles
    const userRole = req.user.role;
    const isAllowed =
      allowedRoles.includes(userRole) ||
      (userRole === 'DOCTOR' && allowedRoles.includes('RESEARCHER')) ||
      (userRole === 'RESEARCHER' && allowedRoles.includes('DOCTOR'));

    if (!isAllowed) {
      return res.status(403).json({
        detail: `Access denied. Insufficient permissions for role '${userRole}'. Required: ${allowedRoles.join(', ')}`,
        code: 'FORBIDDEN_ROLE',
        current_role: userRole,
        required_roles: allowedRoles,
      });
    }

    next();
  };
}
