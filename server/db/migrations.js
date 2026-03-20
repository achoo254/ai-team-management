const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

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
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      team TEXT NOT NULL CHECK(team IN ('dev', 'mkt')),
      seat_id INTEGER REFERENCES seats(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seat_email TEXT NOT NULL,
      date TEXT NOT NULL,
      sessions INTEGER DEFAULT 0,
      commits INTEGER DEFAULT 0,
      lines_added INTEGER DEFAULT 0,
      lines_removed INTEGER DEFAULT 0,
      pull_requests INTEGER DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      estimated_cost_cents REAL DEFAULT 0,
      terminal_type TEXT,
      raw_json TEXT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(seat_email, date)
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
      type TEXT NOT NULL CHECK(type IN ('high_usage', 'limit_warning', 'session_spike', 'no_activity')),
      message TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      resolved_by TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_usage_logs_seat_date ON usage_logs(seat_email, date);
    CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
    CREATE INDEX IF NOT EXISTS idx_schedules_seat ON schedules(seat_id);
  `);
}

/** Seed initial data: 5 seats + 13 users */
function seedData() {
  const db = getDb();
  const defaultPassword = bcrypt.hashSync('123456', 10);

  // Check if already seeded
  const count = db.prepare('SELECT COUNT(*) as c FROM seats').get();
  if (count.c > 0) return;

  const insertSeat = db.prepare(
    'INSERT INTO seats (email, label, team, max_users) VALUES (?, ?, ?, ?)'
  );
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, team, seat_id) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const seedTx = db.transaction(() => {
    // Seats
    insertSeat.run('dattqh@inet.vn', 'TK Đạt', 'dev', 2);
    insertSeat.run('hoangnh@inet.vn', 'TK Hoàng', 'dev', 2);
    insertSeat.run('anhtct@inet.vn', 'TK Tuấn Anh', 'dev', 3);
    insertSeat.run('trihd@inet.vn', 'TK Trí', 'mkt', 3);
    insertSeat.run('quanlm@inet.vn', 'TK Quân', 'mkt', 3);

    // Dev team
    insertUser.run('Đạt', 'dat@inet.vn', defaultPassword, 'admin', 'dev', 1);
    insertUser.run('Hổ', 'ho@inet.vn', defaultPassword, 'user', 'dev', 1);
    insertUser.run('Hoàng', 'hoang@inet.vn', defaultPassword, 'user', 'dev', 2);
    insertUser.run('Chương', 'chuong@inet.vn', defaultPassword, 'user', 'dev', 2);
    insertUser.run('ViệtNT', 'viet@inet.vn', defaultPassword, 'user', 'dev', 3);
    insertUser.run('Đức', 'duc@inet.vn', defaultPassword, 'user', 'dev', 3);
    insertUser.run('Tuấn Anh', 'tuananh@inet.vn', defaultPassword, 'user', 'dev', 3);

    // MKT team
    insertUser.run('Trí', 'tri@inet.vn', defaultPassword, 'user', 'mkt', 4);
    insertUser.run('Hậu', 'hau@inet.vn', defaultPassword, 'user', 'mkt', 4);
    insertUser.run('Trà', 'tra@inet.vn', defaultPassword, 'user', 'mkt', 4);
    insertUser.run('Quân', 'quan@inet.vn', defaultPassword, 'user', 'mkt', 5);
    insertUser.run('Ngọc', 'ngoc@inet.vn', defaultPassword, 'user', 'mkt', 5);
    insertUser.run('Phương', 'phuong@inet.vn', defaultPassword, 'user', 'mkt', 5);

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

/** Run migrations + seed */
function initializeDb() {
  createTables();
  seedData();
}

module.exports = { initializeDb };
