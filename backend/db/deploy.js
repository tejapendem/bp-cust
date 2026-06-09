const { Client } = require('pg');

async function main() {
    const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
    const pgService = (vcap['postgresql-db'] || [])[0];
    if (!pgService) {
        console.error('No postgresql-db service bound');
        process.exit(1);
    }
    const creds = pgService.credentials;

    const client = new Client({
        host: creds.hostname,
        port: parseInt(creds.port),
        database: creds.dbname,
        user: creds.username,
        password: creds.password,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('Connected to PostgreSQL');

    const schema = process.env.DB_SCHEMA;
    if (schema) {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
        console.log(`Schema "${schema}" ensured`);
    } else {
        console.log('No DB_SCHEMA set, skipping schema creation (using default)');
    }

    await client.end();
    console.log('Schema setup done, starting cds-deploy...');

    const { execSync } = require('child_process');
    execSync('npx cds-deploy', { stdio: 'inherit' });
}

main().catch(err => {
    console.error('Deploy failed:', err);
    process.exit(1);
});
