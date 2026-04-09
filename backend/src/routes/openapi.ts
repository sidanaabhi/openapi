import { Router, Request, Response } from 'express';
import multer from 'multer';
import yaml from 'js-yaml';
import db from '../db';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function parseSpec(file: Express.Multer.File): object | null {
  const text = file.buffer.toString('utf8');
  try {
    if (file.originalname.endsWith('.json')) {
      return JSON.parse(text);
    }
    return yaml.load(text) as object;
  } catch {
    return null;
  }
}

router.post('/validate', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ valid: false, errors: ['No file uploaded'] });
  }
  const spec = parseSpec(req.file) as Record<string, unknown> | null;
  if (!spec || (!spec.openapi && !spec.swagger)) {
    return res.status(400).json({ valid: false, errors: ['Missing openapi/swagger field'] });
  }
  res.json({ valid: true, errors: [] });
});

router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const spec = parseSpec(req.file) as Record<string, unknown> | null;
  if (!spec || (!spec.openapi && !spec.swagger)) {
    return res.status(400).json({ error: 'Invalid OpenAPI spec' });
  }
  const info = (spec.info ?? {}) as Record<string, string>;
  const name = info.title?.toLowerCase().replace(/\s+/g, '-') ?? 'imported-api';
  try {
    const [row] = await db('apis').insert({
      name,
      display_name: info.title ?? null,
      description: info.description ?? null,
      version: info.version ?? null,
      base_path: `/${name}`,
      backend_url: '',
      openapi_spec: JSON.stringify(spec),
      openapi_raw: JSON.stringify(spec),
      status: 'active',
    }).returning('*');
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.detail ?? e.message });
  }
});

export default router;
