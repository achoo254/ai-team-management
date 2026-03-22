# Code Standards & Patterns

## Module System

- **CommonJS** throughout: `require()` and `module.exports`
- No ES6 import/export syntax
- No transpiler or bundler
- File names: kebab-case (e.g., `firebase-admin-init.js`, `usage-sync-service.js`)

## Naming Conventions

### Variables & Functions
- `camelCase` for variables and function names
- Descriptive names reflecting purpose (e.g., `getWeeklyUsage`, `calculateHighUsageAlerts`)
- Prefix helper functions with verb: `get`, `create`, `update`, `delete`, `send`, `check`

### Database
- `snake_case` for column names (e.g., `week_start`, `daily_all_pct`, `user_id`)
- `snake_case` for table names (e.g., `usage_logs`, `alert_service`)
- `_id` suffix for foreign key columns (e.g., `user_id`, `seat_id`)
- `_at` suffix for datetime columns (e.g., `created_at`)

### Constants
- `UPPER_SNAKE_CASE` for constants (e.g., `DB_PATH`, `HIGH_USAGE_PCT`)

### Route Handlers
- Lowercase HTTP verbs: `GET /api/resource`, `POST /api/resource/:id`
- Plural resource names: `/api/seats`, `/api/users`, `/api/usage-logs`
- Nested resources: `/api/seats/:seatId/schedules`

### Class/Object Keys
- `camelCase` for JSON properties and object keys
- Consistent with database fields when mapping

## Code Organization

### Backend Structure

#### Routes (`routes/*-routes.js`)
- Express router mounted at module export
- All handlers are async (async/await)
- Authentication via middleware before handler
- Error handling: try-catch with res.status().json()
- Return early on validation errors

Example:
```javascript
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth-middleware');
const Seat = require('../models/seat-model');
const router = express.Router();

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    // Validate input
    if (!req.body.name) {
      return res.status(400).json({ error: 'Name required' });
    }
    // Process
    const result = await Seat.create(req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

#### Services (`services/*-service.js`)
- Pure business logic functions (async/await)
- No Express dependencies
- Exported functions callable from routes or cron jobs
- Error handling: throw errors for callers to handle
- Functions prefixed with descriptive verbs

Example:
```javascript
async function calculateHighUsageAlerts() {
  const alerts = [];
  const seats = await Seat.find();

  for (const seat of seats) {
    const usage = await getWeeklyUsage(seat._id);
    if (usage > 80) {
      alerts.push({
        seat_id: seat._id,
        type: 'high_usage',
        message: `Seat at ${usage}% usage`
      });
    }
  }

  return alerts;
}

module.exports = { calculateHighUsageAlerts };
```

#### Middleware (`middleware/*-middleware.js`)
- Express middleware exported as functions
- `authenticate`: Verify JWT from cookie or Bearer header
- `requireAdmin`: Check user.role === 'admin'

Example:
```javascript
const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticate(req, res, next) {
  const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate, requireAdmin };
```

### Frontend Structure

#### HTML Views (`views/view-*.html`)
- Plain HTML with inline styles or CSS classes
- Use semantic HTML (form, table, div, section)
- Data attributes for JS hooks: `data-action="delete-seat"`, `data-id="123"`
- IDs for form inputs: `id="form-seat-name"` (prefix with form context)
- No embedded scripts; keep JS separate

Example:
```html
<div id="seats-view">
  <h1>Seats</h1>
  <form id="form-create-seat">
    <input id="form-seat-name" type="text" placeholder="Seat name" required>
    <button type="submit">Create</button>
  </form>
  <table id="seats-table">
    <tr data-seat-id="123">
      <td>Dev Seat 1</td>
      <td><button data-action="edit">Edit</button></td>
    </tr>
  </table>
</div>
```

#### Dashboard App (`js/dashboard-app.js`)
- Single router managing navigation and view loading
- Each route maps to view file + load handler
- Global app state if needed; minimal for this project
- Event delegation for dynamically loaded content

Example:
```javascript
const app = {
  currentView: null,

  init() {
    this.setupRoutes();
    this.setupNavigation();
  },

  setupRoutes() {
    this.routes = {
      '/dashboard': () => this.loadView('view-dashboard.html'),
      '/seats': () => this.loadView('view-seats.html'),
    };
  },

  loadView(file) {
    fetch(`/views/${file}`)
      .then(r => r.text())
      .then(html => {
        document.getElementById('content').innerHTML = html;
        this.attachHandlers();
      });
  },

  attachHandlers() {
    // Event listeners for loaded view
    document.addEventListener('click', e => {
      if (e.target.dataset.action === 'delete-seat') {
        this.deleteSeat(e.target.dataset.id);
      }
    });
  }
};
```

#### API Client (`js/api-client.js`)
- Fetch wrapper with consistent error handling
- Methods: `get(path)`, `post(path, data)`, `put(path, data)`, `delete(path)`
- Automatic Content-Type, credentials, error parsing
- Throws on non-2xx; caller handles

Example:
```javascript
const api = {
  async get(path) {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return res.json();
  },

  async post(path, data) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return res.json();
  }
};
```

## Error Handling

### Backend
- Always wrap route handlers in try-catch
- Log errors to console with context (e.g., `[DB]`, `[Telegram]`)
- Return appropriate HTTP status codes:
  - 400: Validation error
  - 401: Missing auth
  - 403: Insufficient permissions
  - 500: Server error
- Include error message in response JSON

### Frontend
- Use `api.get()` etc., handle rejections
- Display user-friendly error messages in UI
- Log technical details to console

Example:
```javascript
try {
  const result = await api.post('/api/seats', { name: 'New Seat' });
  showSuccess('Seat created');
} catch (err) {
  console.error('Failed to create seat:', err);
  showError('Could not create seat. Try again later.');
}
```

## Database Patterns

### Queries
- Use Mongoose model methods (async/await)
- Common patterns: `.find()`, `.findById()`, `.findOne()`, `.create()`, `.updateOne()`, `.deleteOne()`
- Always await async operations

Example:
```javascript
const User = require('../models/user-model');

// Find one
const user = await User.findById(userId);

// Find many
const users = await User.find({ active: true }).sort({ name: 1 });

// Create
const newUser = await User.create({ name, email, role: 'user' });
```

### Transactions
- Use Mongoose sessions for multi-step operations
- Wrap with try-catch; session aborts on error

Example:
```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    const user = await User.create([{ name, email }], { session });
    await Seat.updateOne({ _id: seatId }, { $inc: { max_users: 1 } }, { session });
    return user;
  });
} finally {
  await session.endSession();
}
```

### Migrations
- Run on startup via `initializeDb()` in `db/migrations.js` (async function)
- Creates documents if collections don't exist
- Seed data inserted after Mongoose connects

## Security

### Auth
- JWT stored in httpOnly, Secure, SameSite=Strict cookie
- 24-hour expiry; no refresh tokens needed for this project
- Verify token on every protected endpoint

### Database
- Foreign key constraints enforced (`PRAGMA foreign_keys = ON`)
- No SQL injection via prepared statements
- No sensitive data in logs (passwords, tokens)

### API
- CORS enabled for localhost (dev) / specific origin (prod)
- Validate input: required fields, type checks, length limits
- Rate limiting (future enhancement)

### Env Variables
- `.env` file git-ignored; never commit credentials
- Service account JSON in separate secure location
- Template provided in `.env.example`

## Testing & Debugging

### Development
- Run `pnpm dev` for auto-restart on file changes
- Check browser console for frontend errors
- Check server terminal for backend logs

### Database
- Reset with `pnpm run db:reset` (drops MongoDB + re-seeds)
- Connect to MongoDB via `mongosh` if needed
- Use Mongoose models for queries (see Database Patterns section)

### API
- Use curl/Postman to test endpoints
- Frontend network tab for request/response inspection
- Enable CORS for localhost during dev

## Performance Guidelines

### Database
- Index frequently queried columns (e.g., seat_email, user_id, week_start)
- Batch inserts where possible
- Use WAL mode (already set in `database.js`)

### Frontend
- Minimize fetch requests (batch operations if possible)
- Lazy-load views only when needed
- Reuse DOM elements; avoid unnecessary re-renders

### Server
- Cache frequently fetched data (e.g., seats list) with short TTL
- Offload heavy operations to services
- Monitor cron job execution time

## Code Style

### Spacing & Formatting
- 2-space indentation
- One blank line between function definitions
- No trailing whitespace

### Comments
- Comment non-obvious logic; avoid obvious comments
- Use `//` for single-line, `/* */` for multi-line
- JSDoc-style for exported functions (optional):
  ```javascript
  /**
   * Get weekly usage for a seat.
   * @param {Database} db
   * @param {string} seatId
   * @returns {object}
   */
  function getWeeklyUsage(db, seatId) { ... }
  ```

### Linting
- No strict linting required; prioritize functionality
- Avoid syntax errors and obvious bugs
- Use `pnpm start` to verify no runtime errors

## File Size & Modularization

- Keep files under 200 LOC where practical
- Split large services into sub-modules if >150 LOC
- Prefer many small focused files over few large files
- Example: If `telegram-service.js` grows beyond 200 LOC, split into:
  - `telegram-service.js` (exports main functions)
  - `telegram-formatter.js` (message formatting)
  - `telegram-sender.js` (actual sending)

