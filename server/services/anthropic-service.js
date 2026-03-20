const config = require('../config');

const BASE_URL = config.anthropicBaseUrl;
const HEADERS = {
  'x-api-key': config.anthropicAdminKey,
  'anthropic-version': config.anthropicVersion,
  'Content-Type': 'application/json',
};

/** Fetch all pages from a paginated Anthropic API endpoint */
async function fetchAllPages(url, params = {}) {
  const results = [];
  let nextPage = null;

  do {
    const query = new URLSearchParams({ ...params, limit: 100 });
    if (nextPage) query.set('page', nextPage);

    const res = await fetch(`${BASE_URL}${url}?${query}`, { headers: HEADERS });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const items = data.data || data.users || [];
    results.push(...items);

    nextPage = data.has_more ? data.next_page : null;
  } while (nextPage);

  return results;
}

/**
 * Get Claude Code usage report for a specific date
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Promise<Array>} usage records
 */
async function getClaudeCodeUsage(date) {
  return fetchAllPages('/v1/organizations/usage_report/claude_code', {
    starting_at: date,
  });
}

/**
 * Get all organization members
 * @returns {Promise<Array>} member records
 */
async function getMembers() {
  return fetchAllPages('/v1/organizations/users');
}

module.exports = { getClaudeCodeUsage, getMembers };
