const { getDb } = require('../db/database');

/**
 * Manual usage log entry — user self-reports their session
 * @param {{ seatEmail, userId, userName, date, sessions, tokensBefore, tokensAfter, purpose, project }} data
 */
function logUsage(data) {
  const db = getDb();
  const { seatEmail, userId, userName, date, sessions = 1, tokensBefore, tokensAfter, purpose, project } = data;

  // Calculate delta tokens (approximate from % before/after)
  const deltaTokens = (tokensAfter || 0) - (tokensBefore || 0);

  const stmt = db.prepare(`
    INSERT INTO usage_logs
      (seat_email, date, sessions, input_tokens, purpose, project, user_name, user_id, tokens_before, tokens_after, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(seatEmail, date, sessions, deltaTokens, purpose || '', project || '', userName || '', userId || null, tokensBefore || 0, tokensAfter || 0);
  return { success: true, date, seatEmail };
}

/**
 * Import CSV from Claude Console export
 * Expected CSV columns: user_email, date, sessions, lines_accepted, accept_rate
 * @param {Array<object>} rows - parsed CSV rows
 */
function importCsv(rows) {
  const db = getDb();
  let imported = 0;

  const upsert = db.prepare(`
    INSERT INTO usage_logs (seat_email, date, sessions, input_tokens, purpose, project, user_name, synced_at)
    VALUES (?, ?, ?, 0, 'csv-import', '', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(seat_email, date) DO UPDATE SET
      sessions = sessions + excluded.sessions,
      synced_at = CURRENT_TIMESTAMP
  `);

  const importTx = db.transaction((csvRows) => {
    for (const row of csvRows) {
      // Map user email to seat email via users table
      const user = db.prepare(`
        SELECT u.name, s.email as seat_email
        FROM users u JOIN seats s ON s.id = u.seat_id
        WHERE u.email = ?
      `).get(row.user_email || row.email);

      if (!user) continue;

      upsert.run(user.seat_email, row.date, parseInt(row.sessions) || 1, user.name);
      imported++;
    }
  });

  importTx(rows);
  return { imported, total: rows.length };
}

module.exports = { logUsage, importCsv };
