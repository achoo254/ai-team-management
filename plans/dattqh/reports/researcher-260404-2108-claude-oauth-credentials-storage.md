# Claude AI OAuth Credentials Storage Research

**Date:** 2026-04-04  
**Source:** Official Anthropic Claude Code documentation + GitHub issue tracking

---

## Credential Storage Paths

### Windows
**Path:** `C:\Users\{username}\.claude\.credentials.json`  
**Alternative:** `$CLAUDE_CONFIG_DIR\.credentials.json` (if env var set)  
**Permissions:** Inherits user profile directory access controls

### macOS
**Storage:** macOS Keychain (encrypted, not file-based)  
**Not stored as file** — managed by system Keychain

### Linux
**Path:** `~/.claude/.credentials.json`  
**Alternative:** `$CLAUDE_CONFIG_DIR/.credentials.json` (if env var set)  
**Permissions:** File mode `0600` (read/write owner only)

---

## File Format (.credentials.json)

```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",
    "refreshToken": "sk-ant-ort01-...",
    "expiresAt": 1748658860401,
    "scopes": ["user:inference", "user:profile"]
  }
}
```

**Field details:**
- `accessToken`: Short-lived (8-12 hours), used for API requests
- `refreshToken`: Long-lived, used to obtain new access tokens
- `expiresAt`: Millisecond timestamp when access token expires
- `scopes`: OAuth permission array

---

## Configuration Override

**Environment Variable:** `CLAUDE_CONFIG_DIR`

When set, Claude Code uses this directory instead of `~/.claude/`.

---

## Alternative Authentication Methods

The `.credentials.json` file supports multiple credential types:
- Claude.ai OAuth credentials
- Claude API credentials (Console API keys)
- Azure Auth
- Bedrock Auth
- Vertex Auth

---

## Key Points

- **macOS different:** Uses system Keychain, not file storage (cannot manually copy credentials between machines)
- **Refresh handling:** `refreshToken` automatically used when `accessToken` expires
- **Terminal vs Desktop:** OAuth credentials are used by CLI and Desktop. Environment variables (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`) and `apiKeyHelper` apply to terminal sessions only
- **No official migration tool:** Manual credential transfer between systems requires reading Linux/Windows JSON file and manually importing on destination

---

## Sources

- [Authentication - Claude Code Docs](https://code.claude.com/docs/en/authentication) — Official Anthropic documentation
- [GitHub: claude-code issue #1414](https://github.com/anthropics/claude-code/issues/1414) — macOS Keychain vs Linux file storage discrepancy
- [GitHub: claude-code issue #3833](https://github.com/anthropics/claude-code/issues/3833) — CLAUDE_CONFIG_DIR behavior notes

---

## Unresolved Questions

- Is there a programmatic API to read credentials on macOS without Keychain access?
- What happens if credentials on Windows are stored on a network drive/UNC path?
