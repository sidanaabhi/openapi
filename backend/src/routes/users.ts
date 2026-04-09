import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const users = await db('users').select('*').orderBy('created_at', 'desc');
    const userIds = users.map((u: any) => u.id);
    const roles = userIds.length
      ? await db('user_roles').whereIn('user_id', userIds).select('*')
      : [];
    const result = users.map((u: any) => ({
      ...u,
      roles: roles.filter((r: any) => r.user_id === u.id).map((r: any) => r.role),
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { roles, ...userData } = req.body;
    const [user] = await db('users').insert(userData).returning('*');
    if (roles?.length) {
      await db('user_roles').insert(roles.map((r: string) => ({ user_id: user.id, role: r })));
    }
    res.status(201).json({ ...user, roles: roles ?? [] });
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

router.put('/:id/roles', async (req, res) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) return res.status(404).json({ error: 'Not found' });
    const newRoles: string[] = req.body.roles ?? [];
    await db('user_roles').where({ user_id: req.params.id }).delete();
    if (newRoles.length) {
      await db('user_roles').insert(newRoles.map(r => ({ user_id: req.params.id, role: r })));
    }
    res.json({ ...user, roles: newRoles });
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

export default router;
