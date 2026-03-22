# Phase 2: Database & Models

**Priority:** High | **Status:** pending | **Effort:** 0.5 day

## Overview
SQLite schema cho users, seats, usage logs, schedules.

## Schema

### users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  team TEXT NOT NULL,                  -- 'dev' | 'mkt'
  seat_id INTEGER REFERENCES seats(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### seats
```sql
CREATE TABLE seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,          -- dattqh@inet.vn
  label TEXT NOT NULL,                 -- "TK Đạt"
  team TEXT NOT NULL,                  -- 'dev' | 'mkt'
  max_users INTEGER DEFAULT 3,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### usage_logs (synced from Anthropic API)
```sql
CREATE TABLE usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_email TEXT NOT NULL,            -- actor email from API
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  sessions INTEGER DEFAULT 0,
  commits INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,
  pull_requests INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  estimated_cost_cents REAL DEFAULT 0, -- cents USD
  terminal_type TEXT,
  raw_json TEXT,                       -- full API response for audit
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seat_email, date)
);
```

### schedules (slot booking)
```sql
CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id INTEGER NOT NULL REFERENCES seats(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  day_of_week INTEGER NOT NULL,        -- 0=Mon, 6=Sun
  slot TEXT NOT NULL,                   -- 'morning' | 'afternoon'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seat_id, day_of_week, slot)
);
```

### alerts
```sql
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_email TEXT NOT NULL,
  type TEXT NOT NULL,                  -- 'high_usage' | 'limit_warning'
  message TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Seed Data
Insert 5 seats + 13 users với thông tin từ account structure trong plan.md.

## Implementation Steps
- [ ] Create `server/db/database.js` — SQLite connection singleton
- [ ] Create `server/db/migrations.js` — schema creation + seed data
- [ ] Seed 5 seats (dattqh, hoangnh, anhtct, trihd, quanlm)
- [ ] Seed 13 users with correct seat assignments
- [ ] Seed default schedules for 3-person seats
- [ ] Verify tables created correctly

## Success Criteria
- Database file created at `data/dashboard.db`
- All tables exist with correct schema
- Seed data matches account structure
