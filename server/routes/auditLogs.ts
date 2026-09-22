import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { requireAuth, requireRoles } from '../middleware/auth';
import { store } from '../db/store';

export const auditLogsRouter = Router();

// Only SUPER_ADMIN can view security audit logs
auditLogsRouter.get('/', requireAuth, requireRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

  try {
    const logs = await db.query(
      `SELECT a.id, a.user_id, u.name as user_name, a.action, a.resource, a.status, a.timestamp, a.metadata_json
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.timestamp DESC
       LIMIT $1`,
      [limit]
    );

    if (logs && logs.length > 0) {
      return res.json(logs);
    }
  } catch (err) {
    console.error('[AuditLogs] Error reading from DB:', err);
  }

  // Fallback to store
  return res.json(store.auditLogs.slice(0, limit));
});
