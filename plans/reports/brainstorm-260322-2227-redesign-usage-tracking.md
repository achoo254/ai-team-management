# Brainstorm: Redesign Usage Tracking

## Problem
Current usage_logs schema tracks sessions, tokens, purpose, project — but Claude only provides weekly percentages (All models %, Sonnet only %). No API available, manual entry only.

## Decisions
- **Only track weekly %** — All models + Sonnet only
- **No purpose/project** — Claude doesn't provide, remove extra fields
- **1 log per week** per user per seat
- **Alert threshold**: weekly_all_pct > 80% = high_usage
- **Telegram bot**: weekly report every Friday 17h (Asia/Saigon)
- **Telegram config**: .env (shared for all seats)

## New Schema
```sql
usage_logs: id, seat_email, week_start, weekly_all_pct, weekly_sonnet_pct, user_id, logged_at
UNIQUE(seat_email, week_start, user_id)
```

## Scope
1. DB: Redesign usage_logs table
2. BE: Update routes + services + alerts
3. FE: Redesign log form + dashboard
4. New: Telegram bot integration (cron Friday 17h)
5. Config: Add TG env vars

## Telegram Message Format
- Summary all seats with weekly_all_pct, weekly_sonnet_pct
- Highlight seats > 80% with warning icon
