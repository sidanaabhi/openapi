import Knex from 'knex';

const db = Knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
});

export default db;
