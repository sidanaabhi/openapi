import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const rows = await db('subscriptions as s')
      .leftJoin('users as u', 's.developer_id', 'u.id')
      .leftJoin('products as p', 's.product_id', 'p.id')
      .select(
        's.*',
        db.raw(`json_build_object('email', u.email, 'display_name', u.display_name) as developer`),
        db.raw(`json_build_object('name', p.name, 'display_name', p.display_name) as product`),
      )
      .orderBy('s.created_at', 'desc');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const [row] = await db('subscriptions').insert(req.body).returning('*');
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const [row] = await db('subscriptions')
      .where({ id: req.params.id })
      .update({ status: 'active', approved_at: db.fn.now() })
      .returning('*');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id/reject', async (req, res) => {
  try {
    const [row] = await db('subscriptions')
      .where({ id: req.params.id })
      .update({ status: 'rejected' })
      .returning('*');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const [row] = await db('subscriptions')
      .where({ id: req.params.id })
      .update(req.body)
      .returning('*');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

export default router;
