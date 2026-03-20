const { getClaudeCodeUsage } = require('./anthropic-service');
const { getDb } = require('../db/database');

/** Format date as YYYY-MM-DD */
function formatDate(d) {
  return d.toISOString().split('T')[0];
}

/** Get yesterday's date string */
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

/**
 * Sum token fields from model_breakdown array
 * @param {Array} breakdown
 * @returns {{ input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens }}
 */
function sumTokens(breakdown = []) {
  return breakdown.reduce(
    (acc, m) => {
      acc.input_tokens += m.input_tokens || 0;
      acc.output_tokens += m.output_tokens || 0;
      acc.cache_read_tokens += m.cache_read_tokens || 0;
      acc.cache_creation_tokens += m.cache_creation_tokens || 0;
      return acc;
    },
    { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0 }
  );
}

/**
 * Sync usage data from Anthropic API into usage_logs table
 * @param {string} [date] - ISO date (defaults to yesterday)
 * @returns {Promise<{ synced: number, date: string }>}
 */
async function syncUsageData(date) {
  const targetDate = date || yesterday();
  const records = await getClaudeCodeUsage(targetDate);
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO usage_logs
      (seat_email, date, sessions, input_tokens, output_tokens,
       cache_read_tokens, cache_creation_tokens, estimated_cost_cents, raw_json, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(seat_email, date) DO UPDATE SET
      sessions = excluded.sessions,
      input_tokens = excluded.input_tokens,
      output_tokens = excluded.output_tokens,
      cache_read_tokens = excluded.cache_read_tokens,
      cache_creation_tokens = excluded.cache_creation_tokens,
      estimated_cost_cents = excluded.estimated_cost_cents,
      raw_json = excluded.raw_json,
      synced_at = CURRENT_TIMESTAMP
  `);

  const syncTx = db.transaction((rows) => {
    for (const row of rows) {
      const email = row.actor?.email_address;
      if (!email) continue;

      const tokens = sumTokens(row.model_breakdown);
      const costCents = (row.estimated_cost || 0) * 100;

      upsert.run(
        email,
        targetDate,
        row.sessions || 0,
        tokens.input_tokens,
        tokens.output_tokens,
        tokens.cache_read_tokens,
        tokens.cache_creation_tokens,
        costCents,
        JSON.stringify(row)
      );
    }
  });

  syncTx(records);

  return { synced: records.length, date: targetDate };
}

module.exports = { syncUsageData };
