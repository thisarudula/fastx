const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const pool = require('./db');
const { encrypt, decrypt } = require('./utils/crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'fastx_secret_key_8822',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const isAuth = (req, res, next) => {
    if (req.session.userId) next();
    else res.status(401).json({ error: 'UNAUTHORIZED' });
};

const isAdmin = (req, res, next) => {
    if (req.session.role === 'admin') next();
    else res.status(403).json({ error: 'FORBIDDEN_ZONE' });
};

// Helper: run a parameterised query (converts ? to $n for pg)
async function q(sql, params = []) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const result = await pool.query(pgSql, params);
    return result;
}

// --- AUTH API ---

app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'ALL_FIELDS_REQUIRED' });
    try {
        const uid_4 = Math.floor(1000 + Math.random() * 9000).toString();
        const hash = await bcrypt.hash(password, 10);
        await q('INSERT INTO users (name, email, password_hash, uid_4) VALUES (?, ?, ?, ?)', [name, email, hash, uid_4]);
        res.json({ success: true, uid: uid_4 });
    } catch (err) {
        console.error('SIGNUP_DB_ERROR:', err);
        res.status(400).json({ error: 'EMAIL_ALREADY_EXISTS' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await q('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];
        if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        req.session.userId = user.id;
        req.session.uid_4 = user.uid_4;
        req.session.role = user.role;
        req.session.userName = user.name;
        res.json({ success: true, user: { name: user.name, uid: user.uid_4, role: user.role } });
    } catch (err) {
        console.error('LOGIN_DB_ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
    if (req.session.userId) res.json({ name: req.session.userName, uid: req.session.uid_4, role: req.session.role });
    else res.status(401).json({ error: 'NOT_LOGGED_IN' });
});

// --- DASHBOARD API ---

app.get('/api/dashboard', isAuth, async (req, res) => {
    const userId = req.session.userId;
    const uid_4 = req.session.uid_4;
    try {
        const { rows: manualRows } = await q('SELECT * FROM secrets WHERE user_id = ?', [userId]);
        const { rows: assignedRows } = await q(
            'SELECT id, email, password, encrypted_secret, iv, service_type, creation_date FROM pre_stocked WHERE assigned_to_uid = ?',
            [uid_4]
        );

        const dashboard = [
            ...manualRows.map(r => ({ ...r, type: 'manual' })),
            ...assignedRows.map(r => ({ ...r, type: 'assigned' }))
        ].map(row => {
            try {
                const decryptedSecret = decrypt(row.encrypted_secret, row.iv);
                const token = speakeasy.totp({ secret: decryptedSecret, encoding: 'base32' });
                return {
                    id: row.id,
                    isPreStocked: row.type === 'assigned',
                    name: row.name || 'ChatGPT Account',
                    email: row.email || null,
                    password: row.password || null,
                    token,
                    service_type: row.service_type || null,
                    creation_date: row.creation_date || null,
                    remaining: 30 - (Math.floor(Date.now() / 1000) % 30)
                };
            } catch (e) { return null; }
        }).filter(i => i !== null);

        res.json(dashboard);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/add', isAuth, async (req, res) => {
    const { name, secret } = req.body;
    try {
        const { iv, encryptedData } = encrypt(secret);
        const { rows } = await q(
            'INSERT INTO secrets (user_id, name, encrypted_secret, iv) VALUES (?, ?, ?, ?) RETURNING id',
            [req.session.userId, name, encryptedData, iv]
        );
        res.json({ success: true, id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/terminate/:id', isAuth, async (req, res) => {
    try {
        await q('DELETE FROM secrets WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN API ---

app.post('/api/admin/stock', isAuth, isAdmin, async (req, res) => {
    const { email, password, secret, serviceType, creationDate } = req.body;
    try {
        const { iv, encryptedData } = encrypt(secret);
        const { rows } = await q(
            'INSERT INTO pre_stocked (email, password, encrypted_secret, iv, service_type, creation_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
            [email, password, encryptedData, iv, serviceType, creationDate]
        );
        res.json({ success: true, id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/assign', isAuth, isAdmin, async (req, res) => {
    const { stockId, userUid } = req.body;
    try {
        await q('UPDATE pre_stocked SET assigned_to_uid = ? WHERE id = ?', [userUid, stockId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/inventory', isAuth, isAdmin, async (req, res) => {
    try {
        const { rows } = await q('SELECT id, email, assigned_to_uid, encrypted_secret, iv, service_type, creation_date FROM pre_stocked');
        const enriched = rows.map(i => {
            try {
                const secret = decrypt(i.encrypted_secret, i.iv);
                const token = speakeasy.totp({ secret, encoding: 'base32' });
                return { id: i.id, email: i.email, assigned_to_uid: i.assigned_to_uid, token, service_type: i.service_type, creation_date: i.creation_date };
            } catch (e) {
                return { id: i.id, email: i.email, assigned_to_uid: i.assigned_to_uid, token: 'ERR!!', service_type: i.service_type, creation_date: i.creation_date };
            }
        });
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/unassign', isAuth, isAdmin, async (req, res) => {
    const { stockId } = req.body;
    try {
        await q('UPDATE pre_stocked SET assigned_to_uid = NULL WHERE id = ?', [stockId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/users', isAuth, isAdmin, async (req, res) => {
    try {
        const { rows } = await q('SELECT name, email, uid_4 FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:uid', isAuth, isAdmin, async (req, res) => {
    const uid = req.params.uid;
    if (uid === '0001') return res.status(403).json({ error: 'ROOT_ADMIN_IMMUTABLE' });
    try {
        await q('DELETE FROM users WHERE uid_4 = ?', [uid]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/inventory/:id', isAuth, isAdmin, async (req, res) => {
    try {
        await q('DELETE FROM pre_stocked WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FASTX_CORE: ONLINE // PORT: ${PORT}`));
