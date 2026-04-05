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

export interface OAuthProfile {
  account: {
    uuid: string
    email: string
    full_name: string
    display_name: string
    has_claude_max: boolean
    has_claude_pro: boolean
    created_at: string
  }
  organization: {
    uuid: string
    name: string
    organization_type: string
    billing_type: string
    rate_limit_tier: string
    has_extra_usage_enabled: boolean
    subscription_status: string
    subscription_created_at: string
  }
  application: { uuid: string; name: string; slug: string }
}

/** Error thrown by fetchOAuthProfile — preserves HTTP status + body for caller handling. */
export class OAuthProfileError extends Error {
  constructor(public status: number, public body: string) {
    super(`OAuth profile fetch failed: ${status} ${body}`)
    this.name = 'OAuthProfileError'
  }
}

/** Fetch OAuth profile from Anthropic for a given access token (user OAuth, not admin key). */
export async function fetchOAuthProfile(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch('https://api.anthropic.com/api/oauth/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new OAuthProfileError(res.status, body)
  }
  return await res.json() as OAuthProfile
}
