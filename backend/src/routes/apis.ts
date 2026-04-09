import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const rows = await db('apis').select('*').orderBy('created_at', 'desc');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await db('apis').where({ id: req.params.id }).first();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const [row] = await db('apis').insert(req.body).returning('*');
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const [row] = await db('apis').where({ id: req.params.id }).update(req.body).returning('*');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const count = await db('apis').where({ id: req.params.id }).delete();
    if (!count) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
