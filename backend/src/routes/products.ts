import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const products = await db('products').select('*').orderBy('created_at', 'desc');
    const productIds = products.map((p: any) => p.id);
    const apiLinks = productIds.length
      ? await db('product_apis')
          .whereIn('product_id', productIds)
          .join('apis', 'product_apis.api_id', 'apis.id')
          .select('product_apis.product_id', 'apis.*')
      : [];
    const result = products.map((p: any) => ({
      ...p,
      apis: apiLinks.filter((a: any) => a.product_id === p.id),
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await db('products').where({ id: req.params.id }).first();
    if (!product) return res.status(404).json({ error: 'Not found' });
    const apis = await db('product_apis')
      .where({ product_id: req.params.id })
      .join('apis', 'product_apis.api_id', 'apis.id')
      .select('apis.*');
    res.json({ ...product, apis });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const [row] = await db('products').insert(req.body).returning('*');
    res.status(201).json({ ...row, apis: [] });
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const [row] = await db('products').where({ id: req.params.id }).update(req.body).returning('*');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

router.post('/:productId/apis', async (req, res) => {
  try {
    const product = await db('products').where({ id: req.params.productId }).first();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await db('product_apis')
      .insert({ product_id: req.params.productId, api_id: req.body.api_id })
      .onConflict(['product_id', 'api_id']).ignore();
    const apis = await db('product_apis')
      .where({ product_id: req.params.productId })
      .join('apis', 'product_apis.api_id', 'apis.id')
      .select('apis.*');
    res.json({ ...product, apis });
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

router.delete('/:productId/apis/:apiId', async (req, res) => {
  try {
    await db('product_apis').where({ product_id: req.params.productId, api_id: req.params.apiId }).delete();
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
