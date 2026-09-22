import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  requireAuth,
  requireRoles,
  AuthUserPayload,
} from '../middleware/auth';
import { store } from '../db/store';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Authenticates user credentials against the PostgreSQL / SQLite database.
 * Issues cryptographic JWT token and logs audit event.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required.' });
  }

  try {
    const user = await db.queryOne<{
      id: number;
      hospital_id: number | null;
      name: string;
      email: string;
      password_hash: string;
      role: 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'RESEARCHER';
      status: string;
      created_at: string;
    }>('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);

    if (!user || !verifyPassword(password, user.password_hash)) {
      // Record failed audit attempt
      try {
        await db.execute(
          `INSERT INTO audit_logs (user_id, action, resource, status, timestamp, metadata_json) 
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
          [
            user ? user.id : null,
            'LOGIN_FAILED',
            'AuthService',
            'FAILURE',
            JSON.stringify({ attempted_email: email }),
          ]
        );
      } catch (logErr) {
        console.error('[Auth] Failed to write login failure audit log:', logErr);
      }

      return res.status(401).json({
        detail: 'Invalid healthcare email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        detail: `User account is ${user.status.toLowerCase()}. Access denied.`,
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // Lookup hospital name if associated
    let hospitalName: string | null = null;
    if (user.hospital_id) {
      const hosp = await db.queryOne<{ hospital_name: string }>(
        'SELECT hospital_name FROM hospitals WHERE id = $1',
        [user.hospital_id]
      );
      if (hosp) hospitalName = hosp.hospital_name;
    }

    const payload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hospital_id: user.hospital_id,
      hospital_name: hospitalName,
    };

    const accessToken = generateToken(payload);

    // Record successful audit event
    try {
      await db.execute(
        `INSERT INTO audit_logs (user_id, action, resource, status, timestamp, metadata_json) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
        [
          user.id,
          'USER_LOGIN',
          `AuthService (${user.email})`,
          'SUCCESS',
          JSON.stringify({ role: user.role, hospital_id: user.hospital_id }),
        ]
      );
    } catch (logErr) {
      console.error('[Auth] Failed to write login success audit log:', logErr);
    }

    // Keep in-memory store audit in sync
    store.logAudit(
      'USER_LOGIN',
      `User ${user.email} (${user.role})`,
      'SUCCESS',
      { id: user.id, name: user.name },
      { hospital_id: user.hospital_id }
    );

    return res.json({
      access_token: accessToken,
      token_type: 'bearer',
      role: user.role,
      user_id: user.id,
      name: user.name,
      email: user.email,
      hospital_id: user.hospital_id,
      hospital_name: hospitalName,
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ detail: `Authentication error: ${err.message}` });
  }
});

/**
 * POST /api/auth/register
 * Registers a new user account with bcrypt password hashing and database persistence.
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, role, hospital_id } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ detail: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ detail: 'Password must be at least 6 characters long.' });
  }

  const assignedRole = (role || 'DOCTOR').toUpperCase();
  const validRoles = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'];
  if (!validRoles.includes(assignedRole)) {
    return res.status(400).json({
      detail: `Invalid role '${assignedRole}'. Allowed roles: ${validRoles.join(', ')}`,
    });
  }

  try {
    // Check if email already registered
    const existing = await db.queryOne<{ id: number }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );
    if (existing) {
      return res.status(400).json({ detail: 'Email address is already registered in the system.' });
    }

    // Verify hospital exists if hospital_id provided
    let verifiedHospitalId: number | null = null;
    let hospitalName: string | null = null;
    if (hospital_id) {
      const hosp = await db.queryOne<{ id: number; hospital_name: string }>(
        'SELECT id, hospital_name FROM hospitals WHERE id = $1',
        [hospital_id]
      );
      if (!hosp) {
        return res.status(404).json({ detail: `Hospital node ${hospital_id} does not exist.` });
      }
      verifiedHospitalId = hosp.id;
      hospitalName = hosp.hospital_name;
    }

    // Hash password with bcrypt
    const passwordHash = hashPassword(password);

    // Normalize role for database check constraint if RESEARCHER
    const dbRole = assignedRole === 'RESEARCHER' ? 'DOCTOR' : assignedRole;

    const result = await db.execute(
      `INSERT INTO users (name, email, password_hash, role, hospital_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', CURRENT_TIMESTAMP)`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, dbRole, verifiedHospitalId]
    );

    // Fetch the newly created user
    const newUser = await db.queryOne<{
      id: number;
      name: string;
      email: string;
      role: 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR';
      hospital_id: number | null;
      status: string;
      created_at: string;
    }>('SELECT id, name, email, role, hospital_id, status, created_at FROM users WHERE LOWER(email) = LOWER($1)', [
      email.trim().toLowerCase(),
    ]);

    if (!newUser) {
      throw new Error('Failed to retrieve newly registered user from database.');
    }

    // Audit log
    await db.execute(
      `INSERT INTO audit_logs (user_id, action, resource, status, timestamp, metadata_json)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
      [
        newUser.id,
        'USER_REGISTERED',
        `User ${newUser.email}`,
        'SUCCESS',
        JSON.stringify({ role: newUser.role, hospital_id: newUser.hospital_id }),
      ]
    );

    const payload: AuthUserPayload = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      hospital_id: newUser.hospital_id,
      hospital_name: hospitalName,
    };

    const accessToken = generateToken(payload);

    return res.status(201).json({
      access_token: accessToken,
      token_type: 'bearer',
      role: newUser.role,
      user_id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      hospital_id: newUser.hospital_id,
      hospital_name: hospitalName,
      message: 'Account registered successfully.',
    });
  } catch (err: any) {
    console.error('[Auth] Registration error:', err);
    return res.status(500).json({ detail: `Registration failed: ${err.message}` });
  }
});

/**
 * GET /api/auth/me
 * Protected: Retrieves profile of current authenticated user from token and DB.
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const current = req.user!;
  const user = await db.queryOne<{
    id: number;
    name: string;
    email: string;
    role: string;
    hospital_id: number | null;
    status: string;
    created_at: string;
  }>('SELECT id, name, email, role, hospital_id, status, created_at FROM users WHERE id = $1', [
    current.id,
  ]);

  if (!user) {
    return res.status(404).json({ detail: 'User not found.' });
  }

  let hospitalName: string | null = null;
  if (user.hospital_id) {
    const hosp = await db.queryOne<{ hospital_name: string }>(
      'SELECT hospital_name FROM hospitals WHERE id = $1',
      [user.hospital_id]
    );
    if (hosp) hospitalName = hosp.hospital_name;
  }

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hospital_id: user.hospital_id,
    hospital_name: hospitalName,
    status: user.status,
    created_at: user.created_at,
  });
});

/**
 * POST /api/auth/logout
 * Handles logout and security audit trail.
 */
authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const current = req.user!;
  try {
    await db.execute(
      `INSERT INTO audit_logs (user_id, action, resource, status, timestamp, metadata_json)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
      [
        current.id,
        'USER_LOGOUT',
        `AuthService (${current.email})`,
        'SUCCESS',
        JSON.stringify({ role: current.role }),
      ]
    );
  } catch (err) {
    console.error('[Auth] Logout audit log error:', err);
  }

  return res.json({
    detail: 'Successfully logged out.',
    status: 'ok',
  });
});

/**
 * GET /api/auth/validate-token
 * Validates the JWT token in Authorization header.
 */
authRouter.get('/validate-token', requireAuth, (req: Request, res: Response) => {
  return res.json({
    valid: true,
    user: req.user,
  });
});

/**
 * Protected test endpoints for RBAC verification
 */
authRouter.get('/protected/admin-only', requireAuth, requireRoles('SUPER_ADMIN'), (req: Request, res: Response) => {
  return res.json({
    message: 'Access granted to Admin-Only resource.',
    user: req.user,
  });
});

authRouter.get(
  '/protected/hospital-admin',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  (req: Request, res: Response) => {
    return res.json({
      message: 'Access granted to Hospital Admin resource.',
      user: req.user,
    });
  }
);

authRouter.get(
  '/protected/clinical',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'),
  (req: Request, res: Response) => {
    return res.json({
      message: 'Access granted to Clinical / Research resource.',
      user: req.user,
    });
  }
);
