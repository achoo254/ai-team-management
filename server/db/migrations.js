const { getDb } = require('./database');

/** Migrate from old schema (session-based) to new (weekly percentage-based) */
function migrateSchema() {
  const db = getDb();
  // Check if usage_logs has old 'date' column → needs migration
  const cols = db.prepare("PRAGMA table_info(usage_logs)").all();
  const hasDateCol = cols.some(c => c.name === 'date');
  if (hasDateCol) {
    db.exec('DROP TABLE IF EXISTS usage_logs');
    db.exec('DROP INDEX IF EXISTS idx_usage_logs_seat_date');
  }
  // Check if alerts has old types → needs migration
  const alertCols = db.prepare("PRAGMA table_info(alerts)").all();
  if (alertCols.length > 0) {
    const oldAlerts = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE type IN ('session_spike','limit_warning')").get();
    if (oldAlerts.c > 0) {
      db.exec('DELETE FROM alerts WHERE type IN (\'session_spike\',\'limit_warning\')');
    }
    // Recreate alerts table with new CHECK constraint
    db.exec('DROP TABLE IF EXISTS alerts');
  }
}

/** Create all tables */
function createTables() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      team TEXT NOT NULL CHECK(team IN ('dev', 'mkt')),
      max_users INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      team TEXT NOT NULL CHECK(team IN ('dev', 'mkt')),
      seat_id INTEGER REFERENCES seats(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seat_email TEXT NOT NULL,
      week_start TEXT NOT NULL,
      weekly_all_pct INTEGER DEFAULT 0,
      weekly_sonnet_pct INTEGER DEFAULT 0,
      user_id INTEGER,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(seat_email, week_start, user_id)
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seat_id INTEGER NOT NULL REFERENCES seats(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      slot TEXT NOT NULL CHECK(slot IN ('morning', 'afternoon')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(seat_id, day_of_week, slot)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seat_email TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('high_usage', 'no_activity')),
      message TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      resolved_by TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_usage_logs_seat_week ON usage_logs(seat_email, week_start);
    CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
    CREATE INDEX IF NOT EXISTS idx_schedules_seat ON schedules(seat_id);
  `);
}

/** Seed initial data: 5 seats + 13 users */
function seedData() {
  const db = getDb();
  // Check if already seeded
  const count = db.prepare('SELECT COUNT(*) as c FROM seats').get();
  if (count.c > 0) return;

  const insertSeat = db.prepare(
    'INSERT INTO seats (email, label, team, max_users) VALUES (?, ?, ?, ?)'
  );
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, role, team, seat_id) VALUES (?, ?, ?, ?, ?)'
  );

  const seedTx = db.transaction(() => {
    // Seats
    insertSeat.run('quocdat254@gmail.com', 'TK Đạt', 'dev', 2);
    insertSeat.run('hoangnh@inet.vn', 'TK Hoàng', 'dev', 2);
    insertSeat.run('anhtct@inet.vn', 'TK Tuấn Anh', 'dev', 3);
    insertSeat.run('trihd@inet.vn', 'TK Trí', 'mkt', 3);
    insertSeat.run('quanlm@inet.vn', 'TK Quân', 'mkt', 3);

    // Dev team
    insertUser.run('Đạt', 'quocdat254@gmail.com', 'admin', 'dev', 1);
    insertUser.run('Hổ', 'hobv@inet.vn', 'user','dev', 1);
    insertUser.run('Hoàng', 'hoangnh@inet.vn', 'user','dev', 2);
    insertUser.run('Chương', 'chuongdt@inet.vn', 'user','dev', 2);
    insertUser.run('ViệtNT', 'vietnt@inet.vn', 'user','dev', 3);
    insertUser.run('Đức', 'ducnd@inet.vn', 'user','dev', 3);
    insertUser.run('Tuấn Anh', 'anhtct@inet.vn', 'user','dev', 3);

    // MKT team
    insertUser.run('Trí', 'trihd@inet.vn', 'user','mkt', 4);
    insertUser.run('Hậu', 'hault@inet.vn', 'user','mkt', 4);
    insertUser.run('Trà', 'traht@inet.vn', 'user','mkt', 4);
    insertUser.run('Quân', 'quanlm@inet.vn', 'user','mkt', 5);
    insertUser.run('Ngọc', 'ngocptn@inet.vn', 'user','mkt', 5);
    insertUser.run('Phương', 'phuongttt@inet.vn', 'user','mkt', 5);

    // Default schedules for 3-person seats (seat 3, 4, 5)
    const insertSchedule = db.prepare(
      'INSERT INTO schedules (seat_id, user_id, day_of_week, slot) VALUES (?, ?, ?, ?)'
    );
    // Seat 3 (anhtct): ViệtNT=5, Đức=6, Tuấn Anh=7
    for (let day = 0; day < 5; day++) {
      insertSchedule.run(3, 5 + (day % 3), day, 'morning');
      insertSchedule.run(3, 5 + ((day + 1) % 3), day, 'afternoon');
    }
    // Seat 4 (trihd): Trí=8, Hậu=9, Trà=10
    for (let day = 0; day < 5; day++) {
      insertSchedule.run(4, 8 + (day % 3), day, 'morning');
      insertSchedule.run(4, 8 + ((day + 1) % 3), day, 'afternoon');
    }
    // Seat 5 (quanlm): Quân=11, Ngọc=12, Phương=13
    for (let day = 0; day < 5; day++) {
      insertSchedule.run(5, 11 + (day % 3), day, 'morning');
      insertSchedule.run(5, 11 + ((day + 1) % 3), day, 'afternoon');
    }
  });

  seedTx();
}

/** Add active column to users if not exists */
function migrateActiveColumn() {
  const db = getDb();
  const cols = db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some(c => c.name === 'active')) {
    db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  }
}

/** Create teams table and seed default teams */
function migrateTeamsTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const count = db.prepare('SELECT COUNT(*) as c FROM teams').get().c;
  if (count === 0) {
    db.prepare('INSERT INTO teams (name, label, color) VALUES (?, ?, ?)').run('dev', 'Dev', '#3b82f6');
    db.prepare('INSERT INTO teams (name, label, color) VALUES (?, ?, ?)').run('mkt', 'MKT', '#22c55e');
  }
}

/** Run migrations + seed */
function initializeDb() {
  migrateSchema();
  createTables();
  seedData();
  migrateActiveColumn();
  migrateTeamsTable();
}

module.exports = { initializeDb };
