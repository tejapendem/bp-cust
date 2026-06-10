const { Client } = require('pg');
const fs = require('fs');

const svc = JSON.parse(process.env.VCAP_SERVICES);
const creds = svc['postgresql-db'][0].credentials;
const client = new Client({
  host: creds.hostname,
  port: creds.port,
  database: creds.dbname,
  user: creds.username,
  password: creds.password,
  ssl: { rejectUnauthorized: false }
});

const csn = fs.readFileSync('/home/vcap/app/db/csn.json', 'utf8');

client.connect()
  .then(() => client.query('CREATE TABLE IF NOT EXISTS cds_model(csn TEXT)'))
  .then(() => client.query('DELETE FROM cds_model'))
  .then(() => client.query('INSERT INTO cds_model(csn) VALUES($1)', [csn]))
  .then(() => { console.log('seeded OK, csn length=' + csn.length); return client.end(); })
  .then(() => process.exit(0))
  .catch(e => { console.error(e.message); process.exit(1); });
