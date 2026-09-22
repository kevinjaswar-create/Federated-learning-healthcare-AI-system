import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { requireAuth, requireRoles } from '../middleware/auth';
import { store, HospitalEntity } from '../db/store';

export const hospitalsRouter = Router();

/**
 * GET /api/hospitals
 * Protected: Returns list of hospitals. Available to all authenticated healthcare users.
 */
hospitalsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.query<HospitalEntity>(
      'SELECT id, hospital_name, hospital_code, location, contact_email, status, created_at FROM hospitals ORDER BY id ASC'
    );
    if (rows && rows.length > 0) {
      // Enrich with dataset and training counts from store or DB
      const enriched = rows.map((h) => {
        const storeHosp = store.hospitals.find((sh) => sh.id === h.id);
        return {
          ...h,
          record_count: storeHosp?.record_count || 0,
          training_runs_count: storeHosp?.training_runs_count || 0,
          latest_accuracy: storeHosp?.latest_accuracy || null,
        };
      });
      return res.json(enriched);
    }
  } catch (err) {
    console.error('[Hospitals] DB query error:', err);
  }

  return res.json(store.hospitals);
});

/**
 * GET /api/hospitals/:id
 * Protected: Get specific hospital node.
 */
hospitalsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const row = await db.queryOne<HospitalEntity>(
      'SELECT id, hospital_name, hospital_code, location, contact_email, status, created_at FROM hospitals WHERE id = $1',
      [id]
    );
    if (row) {
      const storeHosp = store.hospitals.find((sh) => sh.id === id);
      return res.json({
        ...row,
        record_count: storeHosp?.record_count || 0,
        training_runs_count: storeHosp?.training_runs_count || 0,
        latest_accuracy: storeHosp?.latest_accuracy || null,
      });
    }
  } catch (err) {
    console.error('[Hospitals] DB query error:', err);
  }

  const hospital = store.hospitals.find((h) => h.id === id);
  if (!hospital) {
    return res.status(404).json({ detail: `Hospital node ${id} not found` });
  }
  return res.json(hospital);
});

/**
 * POST /api/hospitals
 * Protected: ONLY SUPER_ADMIN can provision or register new hospital nodes.
 */
hospitalsRouter.post('/', requireAuth, requireRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { hospital_name, hospital_code, location, contact_email } = req.body;

  if (!hospital_name || !hospital_code) {
    return res.status(400).json({ detail: 'Hospital name and code are required' });
  }

  try {
    const existing = await db.queryOne<{ id: number }>(
      'SELECT id FROM hospitals WHERE hospital_code = $1',
      [hospital_code.trim()]
    );
    if (existing) {
      return res.status(400).json({ detail: `Hospital code ${hospital_code} already registered` });
    }

    await db.execute(
      `INSERT INTO hospitals (hospital_name, hospital_code, location, contact_email, status, created_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', CURRENT_TIMESTAMP)`,
      [hospital_name.trim(), hospital_code.trim(), location || 'Unknown', contact_email || '']
    );

    const created = await db.queryOne<HospitalEntity>(
      'SELECT * FROM hospitals WHERE hospital_code = $1',
      [hospital_code.trim()]
    );

    if (created) {
      store.hospitals.push({
        ...created,
        record_count: 0,
        training_runs_count: 0,
        latest_accuracy: null,
      });

      await db.execute(
        `INSERT INTO audit_logs (user_id, action, resource, status, timestamp, metadata_json)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
        [
          req.user?.id || null,
          'HOSPITAL_REGISTERED',
          `Hospital ${hospital_name} (${hospital_code})`,
          'SUCCESS',
          JSON.stringify({ location, code: hospital_code }),
        ]
      );

      return res.status(201).json(created);
    }
  } catch (err: any) {
    console.error('[Hospitals] DB insertion error:', err);
  }

  // Fallback to store
  const newHospital: HospitalEntity = {
    id: store.hospitals.length + 1,
    hospital_name,
    hospital_code,
    location: location || 'Unknown',
    contact_email: contact_email || '',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    record_count: 0,
    training_runs_count: 0,
    latest_accuracy: null,
  };

  store.hospitals.push(newHospital);
  return res.status(201).json(newHospital);
});

/**
 * PUT /api/hospitals/:id
 * Protected: SUPER_ADMIN or HOSPITAL_ADMIN of that hospital
 */
hospitalsRouter.put(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'HOSPITAL_ADMIN'),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const currentUser = req.user!;

    // If HOSPITAL_ADMIN, verify they belong to this hospital
    if (currentUser.role === 'HOSPITAL_ADMIN' && currentUser.hospital_id !== id) {
      return res.status(403).json({
        detail: 'Hospital Administrators can only manage their own hospital node.',
        code: 'FORBIDDEN_HOSPITAL_MISMATCH',
      });
    }

    const { hospital_name, location, contact_email, status } = req.body;

    try {
      const existing = await db.queryOne<HospitalEntity>('SELECT * FROM hospitals WHERE id = $1', [id]);
      if (!existing) {
        return res.status(404).json({ detail: `Hospital node ${id} not found` });
      }

      await db.execute(
        `UPDATE hospitals 
         SET hospital_name = COALESCE($1, hospital_name),
             location = COALESCE($2, location),
             contact_email = COALESCE($3, contact_email),
             status = COALESCE($4, status)
         WHERE id = $5`,
        [hospital_name || null, location || null, contact_email || null, status || null, id]
      );

      const updated = await db.queryOne<HospitalEntity>('SELECT * FROM hospitals WHERE id = $1', [id]);

      // Sync store
      const idx = store.hospitals.findIndex((h) => h.id === id);
      if (idx !== -1 && updated) {
        store.hospitals[idx] = { ...store.hospitals[idx], ...updated };
      }

      await db.execute(
        `INSERT INTO audit_logs (user_id, action, resource, status, timestamp, metadata_json)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
        [
          currentUser.id,
          'HOSPITAL_UPDATED',
          `Hospital ${hospital_name || existing.hospital_name}`,
          'SUCCESS',
          JSON.stringify({ id, status }),
        ]
      );

      return res.json(updated || existing);
    } catch (err: any) {
      console.error('[Hospitals] Update error:', err);
      return res.status(500).json({ detail: `Update failed: ${err.message}` });
    }
  }
);
