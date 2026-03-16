const { Pool } = require('pg');

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'postgres',
            ssl: { rejectUnauthorized: false }
          }
);  // required for Supabase/Render

// Auto-create tables on startup
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                uid_4 TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user'
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS secrets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                encrypted_secret TEXT NOT NULL,
                iv TEXT NOT NULL
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS pre_stocked (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                password TEXT NOT NULL,
                encrypted_secret TEXT NOT NULL,
                iv TEXT NOT NULL,
                service_type TEXT,
                creation_date TEXT,
                assigned_to_uid TEXT
            )
        `);

        console.log('DB: Tables verified / created');
    } finally {
        client.release();
    }
}

initDB().catch(err => console.error('DB_INIT_ERROR:', err.message));

// Helper: run a query and return rows
pool.query_ = async (sql, params = []) => {
    // Convert SQLite ? placeholders to PostgreSQL $1, $2, ...
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const result = await pool.query(pgSql, params);
    return result;
};

module.exports = pool;
