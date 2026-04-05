// Shared credential JSON parser — accepts both claudeAiOauth wrapper and raw object,
// and tolerates both camelCase and snake_case keys. Used by web + api.

export interface ParsedCredential {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
  scopes: string[]
  subscriptionType: string | null
  rateLimitTier: string | null
}

/** Parse a raw credential JSON string. Returns null on invalid JSON / missing access_token. */
export function parseCredentialJson(raw: string): ParsedCredential | null {
  try {
    const obj = JSON.parse(raw)
    const cred = obj.claudeAiOauth || obj
    const accessToken = cred.accessToken || cred.access_token
    if (!accessToken || typeof accessToken !== 'string') return null
    return {
      accessToken,
      refreshToken: cred.refreshToken || cred.refresh_token || null,
      expiresAt: cred.expiresAt || cred.expires_at || null,
      scopes: Array.isArray(cred.scopes) ? cred.scopes : [],
      subscriptionType: cred.subscriptionType || cred.subscription_type || null,
      rateLimitTier: cred.rateLimitTier || cred.rate_limit_tier || null,
    }
  } catch {
    return null
  }
}
