const SQL_WASM_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/';
let dbInstance = null;

function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function uint8ArrayToBase64(uint8Array) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}

function saveDB() {
    if (!dbInstance) return;
    const data = dbInstance.export();
    localStorage.setItem('studyPlannerDB', uint8ArrayToBase64(data));
}

async function initDB() {
    if (dbInstance) return dbInstance;
    const SQL = await initSqlJs({
        locateFile: file => `${SQL_WASM_CDN}${file}`
    });

    const saved = localStorage.getItem('studyPlannerDB');
    if (saved) {
        const buffer = base64ToUint8Array(saved);
        dbInstance = new SQL.Database(buffer);
    } else {
        dbInstance = new SQL.Database();
        initSchema(dbInstance);
        saveDB();
    }
    return dbInstance;
}

function initSchema(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            active_plan_id TEXT
        );
        CREATE TABLE IF NOT EXISTS plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT,
            plan_id TEXT,
            title TEXT,
            description TEXT,
            content TEXT,
            saved_at INTEGER,
            UNIQUE(user_email, plan_id)
        );
        CREATE TABLE IF NOT EXISTS task_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT,
            plan_id TEXT,
            task_id TEXT,
            completed INTEGER,
            UNIQUE(user_email, plan_id, task_id)
        );
    `);
}

async function getUserByEmail(email) {
    const db = await initDB();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    stmt.bind([email.trim().toLowerCase()]);
    let result = null;
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();
    return result;
}

async function createUser(name, email, password) {
    const db = await initDB();
    const existing = await getUserByEmail(email);
    if (existing) {
        throw new Error('UserExists');
    }
    db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name.trim(), email.trim().toLowerCase(), password]);
    saveDB();
    return getUserByEmail(email);
}

async function setActivePlanId(email, planId) {
    const db = await initDB();
    db.run('UPDATE users SET active_plan_id = ? WHERE email = ?', [planId, email.trim().toLowerCase()]);
    saveDB();
}

async function savePlanForUser(email, plan) {
    const db = await initDB();
    const content = JSON.stringify(plan);
    db.run(
        'INSERT OR REPLACE INTO plans (user_email, plan_id, title, description, content, saved_at) VALUES (?, ?, ?, ?, ?, ?)',
        [email.trim().toLowerCase(), plan.id, plan.title, plan.description, content, plan.savedAt || Date.now()]
    );
    saveDB();
}

async function getPlanById(email, planId) {
    const db = await initDB();
    const stmt = db.prepare('SELECT * FROM plans WHERE user_email = ? AND plan_id = ?');
    stmt.bind([email.trim().toLowerCase(), planId]);
    let row = null;
    if (stmt.step()) {
        const obj = stmt.getAsObject();
        row = {
            ...obj,
            content: obj.content ? JSON.parse(obj.content) : null
        };
    }
    stmt.free();
    return row;
}

async function loadPlansForUser(email) {
    const db = await initDB();
    const stmt = db.prepare('SELECT * FROM plans WHERE user_email = ? ORDER BY saved_at DESC');
    stmt.bind([email.trim().toLowerCase()]);
    const rows = [];
    while (stmt.step()) {
        const obj = stmt.getAsObject();
        rows.push({
            ...obj,
            content: obj.content ? JSON.parse(obj.content) : null
        });
    }
    stmt.free();
    return rows;
}

async function loadActivePlanForUser(email) {
    const user = await getUserByEmail(email);
    if (!user || !user.active_plan_id) return null;
    return getPlanById(email, user.active_plan_id);
}

async function deletePlanForUser(email, planId) {
    const db = await initDB();
    db.run('DELETE FROM plans WHERE user_email = ? AND plan_id = ?', [email.trim().toLowerCase(), planId]);
    db.run('DELETE FROM task_progress WHERE user_email = ? AND plan_id = ?', [email.trim().toLowerCase(), planId]);
    const user = await getUserByEmail(email);
    if (user && user.active_plan_id === planId) {
        db.run('UPDATE users SET active_plan_id = NULL WHERE email = ?', [email.trim().toLowerCase()]);
    }
    saveDB();
}

async function getTaskCompletion(email, planId, taskId) {
    const db = await initDB();
    const stmt = db.prepare('SELECT completed FROM task_progress WHERE user_email = ? AND plan_id = ? AND task_id = ?');
    stmt.bind([email.trim().toLowerCase(), planId, taskId]);
    let completed = false;
    if (stmt.step()) {
        completed = stmt.getAsObject().completed === 1;
    }
    stmt.free();
    return completed;
}

async function getTaskProgressForPlan(email, planId) {
    const db = await initDB();
    const stmt = db.prepare('SELECT task_id, completed FROM task_progress WHERE user_email = ? AND plan_id = ?');
    stmt.bind([email.trim().toLowerCase(), planId]);
    const progress = {};
    while (stmt.step()) {
        const row = stmt.getAsObject();
        progress[row.task_id] = row.completed === 1;
    }
    stmt.free();
    return progress;
}

async function setTaskCompletion(email, planId, taskId, completed) {
    const db = await initDB();
    db.run(
        'INSERT OR REPLACE INTO task_progress (user_email, plan_id, task_id, completed) VALUES (?, ?, ?, ?)',
        [email.trim().toLowerCase(), planId, taskId, completed ? 1 : 0]
    );
    saveDB();
}

async function clearTaskProgressForPlan(email, planId) {
    const db = await initDB();
    db.run('DELETE FROM task_progress WHERE user_email = ? AND plan_id = ?', [email.trim().toLowerCase(), planId]);
    saveDB();
}

async function getAllUsers() {
    const db = await initDB();
    const result = db.exec('SELECT * FROM users');
    if (!result.length) return [];
    return result[0].values.map(row => {
        const obj = {};
        result[0].columns.forEach((col, index) => {
            obj[col] = row[index];
        });
        return obj;
    });
}

async function getAllPlans() {
    const db = await initDB();
    const result = db.exec('SELECT * FROM plans ORDER BY saved_at DESC');
    if (!result.length) return [];
    return result[0].values.map(row => {
        const obj = {};
        result[0].columns.forEach((col, index) => {
            obj[col] = row[index];
        });
        if (obj.content) obj.content = JSON.parse(obj.content);
        return obj;
    });
}
