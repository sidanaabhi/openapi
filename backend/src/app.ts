import express from 'express';
import apisRouter from './routes/apis';
import productsRouter from './routes/products';
import subscriptionsRouter from './routes/subscriptions';
import usersRouter from './routes/users';
import openapiRouter from './routes/openapi';

const app = express();
const port = process.env.PORT ?? 3001;

app.use(express.json());

// Allow requests from the admin/user portals in development
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/apis', apisRouter);
app.use('/api/products', productsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/users', usersRouter);
app.use('/api/openapi', openapiRouter);

app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});
