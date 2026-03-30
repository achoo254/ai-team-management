---
phase: 3
priority: high
status: completed
effort: S
---

# Phase 3: Services Tests

## Overview

Test business logic services with real MongoDB. Mock only external API calls (Telegram, Anthropic).

## Services to Test

### 1. `services/alert-service.ts`

**File:** `tests/services/alert-service.test.ts`

| Test | Description |
|------|-------------|
| High usage alert | Seed usage logs > 80% → alert created |
| Inactivity alert | No usage logs for 1+ week → alert created |
| No false alerts | Normal usage → no alerts |
| Duplicate prevention | Same alert condition → don't create duplicate |

### 2. `services/usage-sync-service.ts`

**File:** `tests/services/usage-sync-service.test.ts`

| Test | Description |
|------|-------------|
| Sync creates logs | Mock Anthropic API response → usage logs created in DB |
| Handles empty response | Anthropic returns no data → no errors |

### 3. `services/telegram-service.ts`

**File:** `tests/services/telegram-service.test.ts`

| Test | Description |
|------|-------------|
| Send message | Mock fetch → correct Telegram API call format |
| Send reminder | Builds correct message from schedule data |
| Error handling | API failure → graceful error, no crash |

### 4. `services/anthropic-service.ts`

**File:** `tests/services/anthropic-service.test.ts`

| Test | Description |
|------|-------------|
| Fetch usage | Mock fetch → parses response correctly |
| API error | Mock 500 → handles gracefully |

## Mock Strategy

- `global.fetch` mock for Telegram + Anthropic HTTP calls
- Real MongoDB for alert-service and usage-sync-service DB operations

## Files to Create

- `tests/services/alert-service.test.ts`
- `tests/services/usage-sync-service.test.ts`
- `tests/services/telegram-service.test.ts`
- `tests/services/anthropic-service.test.ts`

## Success Criteria

- [ ] Alert service creates correct alert types in real DB
- [ ] External API calls are mocked, not real
- [ ] Error handling paths covered
