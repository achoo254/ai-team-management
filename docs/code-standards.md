# Code Standards & Patterns

## Module System

- **ES Modules** throughout: `import`/`export`
- **TypeScript** for all source files
- **Compilation**: TypeScript compiled to JavaScript in `dist/` directories
- **Package Manager**: pnpm workspaces for monorepo management
- File names: kebab-case (e.g., `firebase-admin.ts`, `usage-sync-service.ts`)

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
- Plural resource names: `/api/seats`, `/api/users`, `/api/usage-snapshots`
- Nested resources: `/api/seats/:seatId/schedules`

### Class/Object Keys
- `camelCase` for JSON properties and object keys
- Consistent with database fields when mapping

## Code Organization

### Backend Structure (`packages/api/src`)

#### Routes (`routes/*.ts`)
- Express router with TypeScript types
- All handlers are async (async/await)
- Authentication via middleware before handler
- Error handling: try-catch with res.status().json()
- Return early on validation errors

Example:
```typescript
import express from 'express';
import { authenticate, requireAdmin } from '../middleware';
import Seat from '../models/seat';
import type { Request, Response } from 'express';

const router = express.Router();

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
```

#### Services (`services/*.ts`)
- Pure business logic functions (async/await)
- No Express dependencies
- Exported functions callable from routes or cron jobs
- Error handling: throw errors for callers to handle
- Functions prefixed with descriptive verbs
- Strong typing for parameters and return values

Example:
```typescript
import Seat from '../models/seat';

export async function checkSnapshotAlerts(): Promise<number> {
  const alerts: Alert[] = [];
  const snapshots = await UsageSnapshot.find({ fetched_at: { $gte: new Date(Date.now() - 3600000) } });
  const settings = await getOrCreateSettings();

  for (const snapshot of snapshots) {
    if (snapshot.five_hour_pct !== null && snapshot.five_hour_pct > settings.alerts.rate_limit_pct) {
      const existing = await Alert.findOne({ seat_id: snapshot.seat_id, type: 'rate_limit', resolved: false });
      if (!existing) {
        alerts.push({
          seat_id: snapshot.seat_id,
          type: 'rate_limit',
          message: `Usage at ${snapshot.five_hour_pct}%`,
          metadata: { window: '5h', pct: snapshot.five_hour_pct }
        });
      }
    }
  }

  const created = await Alert.insertMany(alerts);
  return created.length;
}
```

#### Middleware (`middleware.ts`)
- Express middleware as TypeScript functions
- `authenticate()`: Verify JWT from cookie or Bearer header
- `requireAdmin()`: Check user.role === 'admin'

Example:
```typescript
import jwt from 'jsonwebtoken';
import config from './config';
import type { Request, Response, NextFunction } from 'express';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret) as UserPayload;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

### Frontend Structure (`packages/web/src`)

#### React Components (`components/*.tsx`)
- Functional components with TypeScript types
- Use React hooks (useState, useEffect, useContext)
- Props typing with TypeScript interfaces
- Reusable, focused components (single responsibility)
- Use Base UI React for unstyled, accessible components
- Tailwind CSS for styling

Example:
```typescript
import React from 'react';
import type { FC } from 'react';
import { Button } from '@base-ui/react/button';

interface SeatFormProps {
  onSubmit: (data: SeatFormData) => Promise<void>;
  isLoading?: boolean;
}

export const SeatForm: FC<SeatFormProps> = ({ onSubmit, isLoading = false }) => {
  const [formData, setFormData] = React.useState<SeatFormData>({
    name: '',
    team: 'dev',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Seat name"
        required
      />
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create'}
      </Button>
    </form>
  );
};
```

#### Page Components (`pages/*.tsx`)
- Top-level route components
- Connect to React Query for server state
- Manage page-level state via useState/useContext
- Use layout components for consistent UI

Example:
```typescript
import { useQuery } from '@tanstack/react-query';
import { SeatForm } from '../components/seat-form';
import { SeatsTable } from '../components/seats-table';
import { api } from '../lib/api';

export default function SeatsPage() {
  const { data: seats, isLoading } = useQuery({
    queryKey: ['seats'],
    queryFn: () => api.get('/api/seats'),
  });

  const handleCreateSeat = async (data: SeatFormData) => {
    await api.post('/api/seats', data);
    // React Query will auto-refetch
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Seats</h1>
      <SeatForm onSubmit={handleCreateSeat} />
      <SeatsTable seats={seats} />
    </div>
  );
}
```

#### API Client (`lib/api.ts`)
- Fetch wrapper with consistent error handling
- Methods: `get()`, `post()`, `put()`, `delete()`
- Automatic Content-Type, credentials, error parsing
- TypeScript generic for response types
- Throws on non-2xx; caller handles via React Query

Example:
```typescript
export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return res.json();
  },

  async post<T>(path: string, data: unknown): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
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
- TypeScript typing via Mongoose Document types

Example:
```typescript
import User from '../models/user';
import type { IUser } from '../models/user';

// Find one
const user = await User.findById(userId) as IUser | null;

// Find many
const users = await User.find({ active: true }).sort({ name: 1 }) as IUser[];

// Create
const newUser = await User.create({ 
  name, 
  email, 
  role: 'user' 
}) as IUser;
```

### Transactions
- Use Mongoose sessions for multi-step operations
- Wrap with try-catch; session aborts on error

Example:
```typescript
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

### Database Initialization
- MongoDB collections created on first access via Mongoose
- Schema validation enforced at model level
- No automatic seed data on startup

## Security

### Auth
- JWT stored in httpOnly, Secure, SameSite=Strict cookie
- 24-hour expiry; no refresh tokens needed for this project
- Verify token on every protected endpoint

### Database
- Foreign key relationships enforced via Mongoose schema references
- Input validation prevents injection attacks
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
- Backend: Run `pnpm dev:api` for tsx watch with auto-restart on changes
- Frontend: Run `pnpm dev:web` for Vite with HMR (Hot Module Replacement)
- Combined: Run `pnpm dev` to start both in parallel
- Check browser console for frontend errors
- Check API terminal for backend logs

### Database
- Connect to MongoDB via `mongosh` if needed for manual queries
- Use Mongoose models for queries (see Database Patterns section)
- Drop collections manually in mongosh if needed for testing: `db.collection_name.deleteMany({})`

### API Testing
- Use curl/Postman to test endpoints
- Frontend network tab for request/response inspection
- Vite dev server proxies /api to http://localhost:3001

### Testing Framework
- Test runner: Vitest
- Commands: `pnpm test` (run once), `pnpm test:watch`, `pnpm test:coverage`

## Performance Guidelines

### Database
- Index frequently queried columns (e.g., user_id, week_start, seat_id, day_of_week)
- Batch inserts where possible
- Mongoose connection pooling enabled by default

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

### TypeScript Conventions
- Use strict mode: `"strict": true` in tsconfig.json
- Explicit types for function parameters and return values
- Avoid `any`; use `unknown` when necessary with proper type narrowing
- Import types explicitly: `import type { Foo }` for type-only imports

### Comments
- Comment non-obvious logic; avoid obvious comments
- Use `//` for single-line, `/* */` for multi-line
- JSDoc-style for exported functions:
  ```typescript
  /**
   * Get weekly usage for a seat.
   * @param seatId - The seat ObjectId
   * @returns Promise resolving to usage percentage
   */
  export async function getWeeklyUsage(seatId: string): Promise<number> { ... }
  ```

### Linting
- Run `pnpm lint` to check code (ESLint)
- Fix automatically with `pnpm lint --fix`
- Prioritize functionality over strict style enforcement
- Avoid syntax errors and TypeScript type errors

## Notification Patterns

### Telegram Notifications (Alert & Report Flow)

Notifications are sent via two primary mechanisms:

**1. Alert Notifications** (triggered by usage snapshot evaluation):
- Sent via user's personal Telegram bot
- Includes alert type (rate_limit, extra_credit, token_failure, usage_exceeded)
- Fallback to system bot if personal bot unconfigured
- Non-blocking: errors logged but don't block request flow

**2. Scheduled Reports** (per-user configurable delivery):
- Sent via personal Telegram bot per user's schedule
- Hourly cron evaluates matching day/hour for each user
- Report filtered by seat ownership (admin sees all, users see own)
- Timezone: Asia/Ho_Chi_Minh (server-side)

**3. Weekly Summary** (admin notification):
- Sent Friday 17:00 Asia/Saigon
- Sent via system bot to configured group chat
- Includes usage summary + alert count

**Key Rules**:
- Personal bots required for per-user notifications (alerts, schedules)
- System bot used only for group-wide summaries
- Errors logged but don't block request/cron execution
- Non-blocking: fire-and-forget pattern for all Telegram sends

## File Size & Modularization

- Keep files under 200 LOC where practical
- Split large services into sub-modules if >150 LOC
- Prefer many small focused files over few large files
- Example: If `telegram-service.js` grows beyond 200 LOC, split into:
  - `telegram-service.js` (exports main functions)
  - `telegram-formatter.js` (message formatting)
  - `telegram-sender.js` (actual sending)

