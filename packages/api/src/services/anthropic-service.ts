import { config } from '../config.js'

const { baseUrl, adminKey, version } = config.anthropic

const HEADERS: Record<string, string> = {
  'x-api-key': adminKey,
  'anthropic-version': version,
  'Content-Type': 'application/json',
}

/** Fetch all pages from a paginated Anthropic API endpoint */
async function fetchAllPages<T>(url: string, params: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = []
  let nextPage: string | null = null

  do {
    const query = new URLSearchParams({ ...params, limit: '100' })
    if (nextPage) query.set('page', nextPage)

    const res = await fetch(`${baseUrl}${url}?${query}`, { headers: HEADERS })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${body}`)
    }

    const data = await res.json()
    const items = data.data || data.users || []
    results.push(...items)

    nextPage = data.has_more ? data.next_page : null
  } while (nextPage)

  return results
}

/** Get Claude Code usage report for a specific date */
export async function getClaudeCodeUsage(date: string) {
  return fetchAllPages('/v1/organizations/usage_report/claude_code', {
    starting_at: date,
  })
}

/** Get all organization members */
export async function getMembers() {
  return fetchAllPages('/v1/organizations/users')
}
