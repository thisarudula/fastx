const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const db = require('./db');
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
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

const isAuth = (req, res, next) => {
    if (req.session.userId) next();
    else res.status(401).json({ error: 'UNAUTHORIZED' });
};

const isAdmin = (req, res, next) => {
    if (req.session.role === 'admin') next();
    else res.status(403).json({ error: 'FORBIDDEN_ZONE' });
};

// --- AUTH API ---

app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'ALL_FIELDS_REQUIRED' });
    const uid_4 = Math.floor(1000 + Math.random() * 9000).toString();
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name, email, password_hash, uid_4) VALUES (?, ?, ?, ?)', [name, email, hash, uid_4], function (err) {
        if (err) return res.status(400).json({ error: 'EMAIL_ALREADY_EXISTS' });
        res.json({ success: true, uid: uid_4 });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        req.session.userId = user.id;
        req.session.uid_4 = user.uid_4;
        req.session.role = user.role;
        req.session.userName = user.name;
        res.json({ success: true, user: { name: user.name, uid: user.uid_4, role: user.role } });
    });
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

app.get('/api/dashboard', isAuth, (req, res) => {
    const userId = req.session.userId;
    const uid_4 = req.session.uid_4;
    console.log(`FETCH_DASHBOARD: UserID=${userId}, UID4=${uid_4}`);

    db.all('SELECT * FROM secrets WHERE user_id = ?', [userId], (err, manualRows) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all('SELECT id, email, password, encrypted_secret, iv, service_type, creation_date FROM pre_stocked WHERE assigned_to_uid = ?', [uid_4], (err, assignedRows) => {
            if (err) return res.status(500).json({ error: err.message });
            console.log(`DASHBOARD_DATA: Manual=${manualRows.length}, Assigned=${assignedRows.length}`);

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
        });
    });
});

app.post('/api/add', isAuth, (req, res) => {
    const { name, secret } = req.body;
    const { iv, encryptedData } = encrypt(secret);
    db.run('INSERT INTO secrets (user_id, name, encrypted_secret, iv) VALUES (?, ?, ?, ?)', [req.session.userId, name, encryptedData, iv], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/terminate/:id', isAuth, (req, res) => {
    db.run('DELETE FROM secrets WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- ADMIN API ---

app.post('/api/admin/stock', isAuth, isAdmin, (req, res) => {
    const { email, password, secret, serviceType, creationDate } = req.body;
    const { iv, encryptedData } = encrypt(secret);
    db.run('INSERT INTO pre_stocked (email, password, encrypted_secret, iv, service_type, creation_date) VALUES (?, ?, ?, ?, ?, ?)', [email, password, encryptedData, iv, serviceType, creationDate], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        console.log(`STOCK_INITIALIZED: ID=${this.lastID}, Date=${creationDate}`);
        res.json({ success: true, id: this.lastID });
    });
});

app.post('/api/admin/assign', isAuth, isAdmin, (req, res) => {
    const { stockId, userUid } = req.body;
    db.run('UPDATE pre_stocked SET assigned_to_uid = ? WHERE id = ?', [userUid, stockId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/admin/inventory', isAuth, isAdmin, (req, res) => {
    db.all('SELECT id, email, assigned_to_uid, encrypted_secret, iv, service_type, creation_date FROM pre_stocked', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
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
    });
});

app.post('/api/admin/unassign', isAuth, isAdmin, (req, res) => {
    const { stockId } = req.body;
    db.run('UPDATE pre_stocked SET assigned_to_uid = NULL WHERE id = ?', [stockId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/admin/users', isAuth, isAdmin, (req, res) => {
    db.all('SELECT name, email, uid_4 FROM users', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/api/admin/users/:uid', isAuth, isAdmin, (req, res) => {
    const uid = req.params.uid;
    if (uid === '0001') return res.status(403).json({ error: 'ROOT_ADMIN_IMMUTABLE' });

    db.run('DELETE FROM users WHERE uid_4 = ?', [uid], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        // Also clean up secrets
        db.run('DELETE FROM secrets WHERE user_id NOT IN (SELECT id FROM users)', [], () => {
            res.json({ success: true });
        });
    });
});

app.delete('/api/admin/inventory/:id', isAuth, isAdmin, (req, res) => {
    db.run('DELETE FROM pre_stocked WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`FASTX_CORE: ONLINE // PORT: ${PORT}`));
