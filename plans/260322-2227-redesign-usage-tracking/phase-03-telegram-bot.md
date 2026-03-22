---
phase: 3
priority: medium
status: pending
effort: small
depends_on: [1]
---

# Phase 3: Telegram Bot Weekly Report

## Overview
Create Telegram service + cron job to send weekly usage summary every Friday 17:00 (Asia/Saigon).

## New File: `server/services/telegram-service.js`

```js
const config = require('../config');
const { getDb } = require('../db/database');

async function sendWeeklyReport() {
  const { botToken, chatId, topicId } = config.telegram;
  if (!botToken || !chatId) return;

  const db = getDb();
  const weekStart = getCurrentWeekStart();

  // Get latest log per seat for current week
  const rows = db.prepare(`
    SELECT s.email, s.label, s.team,
           COALESCE(u.weekly_all_pct, 0) as all_pct,
           COALESCE(u.weekly_sonnet_pct, 0) as sonnet_pct
    FROM seats s
    LEFT JOIN usage_logs u ON u.seat_email = s.email AND u.week_start = ?
    ORDER BY all_pct DESC
  `).all(weekStart);

  // Build message
  let msg = `📊 *Báo cáo Usage tuần ${weekStart}*\n\n`;
  for (const r of rows) {
    const warn = r.all_pct >= 80 ? '⚠️' : '✅';
    msg += `${warn} *${r.label}* (${r.team})\n`;
    msg += `   All: ${r.all_pct}% | Sonnet: ${r.sonnet_pct}%\n`;
  }

  // Highlight high usage
  const high = rows.filter(r => r.all_pct >= 80);
  if (high.length > 0) {
    msg += `\n🔴 *${high.length} seat(s) > 80%* — cần giảm tải!`;
  }

  // Send via Telegram Bot API (native fetch, no dependency needed)
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: msg,
    parse_mode: 'Markdown',
  };
  if (topicId) body.message_thread_id = parseInt(topicId);

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```

No extra npm packages needed — uses native `fetch` (Node 18+).

## Modify: `server/index.js`
Add cron job:
```js
const cron = require('node-cron');
const { sendWeeklyReport } = require('./services/telegram-service');

// Friday 17:00 Asia/Saigon
cron.schedule('0 17 * * 5', () => {
  sendWeeklyReport().catch(err => console.error('[Telegram]', err.message));
}, { timezone: 'Asia/Ho_Chi_Minh' });
```

## Config: `.env.example`
Already added in Phase 1:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_TOPIC_ID=
```

## Success Criteria
- [ ] Telegram service sends formatted message
- [ ] Cron runs every Friday 17h (Asia/Saigon timezone)
- [ ] Message includes all seats with usage %
- [ ] High usage seats (>80%) highlighted
- [ ] No crash if telegram config missing (silent skip)
- [ ] No new npm dependencies
