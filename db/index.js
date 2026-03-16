const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid_4 TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    )`);

    // Manual Secrets Table (owned by user)
    db.run(`CREATE TABLE IF NOT EXISTS secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        encrypted_secret TEXT NOT NULL,
        iv TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Pre-stocked Accounts Table
    db.run(`CREATE TABLE IF NOT EXISTS pre_stocked (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        encrypted_secret TEXT NOT NULL,
        iv TEXT NOT NULL,
        service_type TEXT, -- ChatGPT Plus, Business, etc.
        creation_date TEXT, -- YYYY-MM-DD
        assigned_to_uid TEXT, -- 4-digit ID
        FOREIGN KEY(assigned_to_uid) REFERENCES users(uid_4)
    )`);
});

module.exports = db;
