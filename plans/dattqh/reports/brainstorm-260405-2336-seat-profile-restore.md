# Brainstorm: Seat Profile API + Restore Flow

**Date:** 2026-04-05
**Status:** Approved → Plan

## Problem Statement

1. No API to view seat profile info (account, org, subscription) from Anthropic
2. Deleting a seat then re-adding same email creates new ObjectId → all historical dashboard data (snapshots, metrics, windows, alerts) lost

## Agreed Design

### 1. Profile API — Cache + Force-refresh

**Seat model extension:**
```
profile: {
  account_name, display_name, email,
  org_name, org_type, billing_type,
  rate_limit_tier, subscription_status,
  has_claude_max, has_claude_pro,
  fetched_at
}
```

**Endpoints:**
- `GET /api/seats/:id/profile` — return cached profile. Auto-fetch if stale (>6h)
- `POST /api/seats/:id/profile/refresh` — force-refresh from Anthropic API
- Auto-fetch on seat creation + token refresh

### 2. Restore Flow — User Choice Dialog

**POST /api/seats flow change:**
1. Fetch profile → get email
2. Check active seat with email → 409 duplicate (existing)
3. Check soft-deleted seat with email → return `restorable` info
4. Client shows dialog: Restore (keep history) or Create new (fresh start)
5. `POST /api/seats` with `restore_seat_id` or `force_new: true`

**Restore:**
- Clear `deleted_at = null`
- Update credential (encrypted), set `token_active = true`
- Set `owner_id` = current user
- NO member restore — owner re-assigns manually
- NO schedule restore (already hard-deleted)
- KEEP ObjectId → all historical data intact

**Force-new:**
- Hard-delete old seat + cascade all related data immediately
- Create new seat with new ObjectId

### 3. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Profile storage | Cache in model + refresh endpoint | Avoid hitting Anthropic API every render |
| Restore trigger | User dialog choice | User may want fresh start, not always restore |
| Members on restore | Don't restore | Team may have changed since deletion |
| Watched seats | Don't restore | Thresholds may need reconfiguration |
| Schedules | Can't restore | Already hard-deleted at deletion time |

### 4. Risk Assessment

- **30-day window:** After cleanup cron hard-deletes, restore impossible. Acceptable.
- **Credential security:** Old credential invalidated on delete. Restore requires fresh credential. Safe.
- **Race condition:** Two users restoring same email simultaneously. Mitigate with unique partial index (already exists).

## Next Steps

Create implementation plan via /ck:plan.
