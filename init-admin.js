const db = require('./db');
const bcrypt = require('bcryptjs');
const { encrypt } = require('./utils/crypto');

async function initAdmin() {
    const name = 'ThiZaru';
    const email = 'thizaruudara@gmail.com';
    const password = 'Thisaru@20070310';
    const uid_4 = '0001'; // First user

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    db.run(
        'INSERT OR IGNORE INTO users (name, email, password_hash, uid_4, role) VALUES (?, ?, ?, ?, ?)',
        [name, email, hash, uid_4, 'admin'],
        (err) => {
            if (err) console.error('ADMIN_INIT_ERROR:', err.message);
            else console.log('ADMIN_INITIALIZED: thizaruudara@gmail.com // UID: 0001');
            process.exit();
        }
    );
}

initAdmin();
