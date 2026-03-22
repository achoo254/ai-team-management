# Anthropic APIs Reference

## Authentication

All endpoints require:
- Header: `anthropic-version: 2023-06-01`
- Header: `x-api-key: {ADMIN_API_KEY}` (format: `sk-ant-admin-*`)
- Only organization members with admin role can provision Admin API keys
- Available via Claude Console → Settings → Organization

---

## 1. Claude Code Analytics API

### Endpoint
```
GET /v1/organizations/usage_report/claude_code
```

### Query Parameters
| Parameter | Type | Required | Default | Max |
|-----------|------|----------|---------|-----|
| `starting_at` | string (YYYY-MM-DD) | Yes | — | — |
| `limit` | number | No | 20 | 1000 |
| `page` | string (cursor) | No | — | — |

### Response Schema
```json
{
  "data": [
    {
      "actor": {
        "type": "user_actor" | "api_actor",
        "email_address": "string",  // user_actor only
        "api_key_name": "string"    // api_actor only
      },
      "core_metrics": {
        "commits_by_claude_code": number,
        "lines_of_code": {
          "added": number,
          "removed": number
        },
        "num_sessions": number,
        "pull_requests_by_claude_code": number
      },
      "customer_type": "api" | "subscription",
      "date": "string (YYYY-MM-DD)",
      "model_breakdown": [
        {
          "model": "string",
          "tokens": {
            "input": number,
            "output": number,
            "cache_creation": number,
            "cache_read": number
          },
          "estimated_cost": {
            "amount": number,
            "currency": "string"
          }
        }
      ],
      "organization_id": "string",
      "terminal_type": "string",
      "tool_actions": {
        "[tool_name]": {
          "accepted": number,
          "rejected": number
        }
      },
      "subscription_type": "enterprise" | "team" | null  // null for API customers
    }
  ],
  "has_more": boolean,
  "next_page": "string (cursor)" | null
}
```

### Example Request
```bash
curl "https://api.anthropic.com/v1/organizations/usage_report/claude_code?starting_at=2025-09-08&limit=50" \
  --header "anthropic-version: 2023-06-01" \
  --header "x-api-key: sk-ant-admin-xxx"
```

### Features
- Returns daily aggregated metrics only (single day per request)
- Cursor-based pagination via `page` parameter
- Tracks commits, lines of code, sessions, PRs by model breakdown
- Includes estimated costs per model

---

## 2. Admin API — Member Management

### 2.1 List Organization Members
```
GET /v1/organizations/users
```

| Parameter | Type | Required |
|-----------|------|----------|
| `limit` | number | No |

**Response:** Array of user objects with roles

### 2.2 Create Organization Invite
```
POST /v1/organizations/invites
```

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `email` | string | Yes | — |
| `role` | string | Yes | Cannot be "admin" |

**Valid Roles:** `user`, `claude_code_user`, `developer`, `billing`
**Expires:** 21 days (non-modifiable)

### 2.3 List Organization Invites
```
GET /v1/organizations/invites
```

| Parameter | Type | Required |
|-----------|------|----------|
| `limit` | number | No |

### 2.4 Delete Organization Invite
```
DELETE /v1/organizations/invites/{invite_id}
```

### 2.5 Update Member Role
```
POST /v1/organizations/users/{user_id}
```

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `role` | string | Yes | New role for member |

**Valid Roles:** `user`, `claude_code_user`, `developer`, `billing`, `admin`

### 2.6 Remove Organization Member
```
DELETE /v1/organizations/users/{user_id}
```

**Restriction:** Admin users cannot be removed via API

### 2.7 Workspace Member Management

#### Add Member to Workspace
```
POST /v1/organizations/workspaces/{workspace_id}/members
```

| Parameter | Type | Required |
|-----------|------|----------|
| `user_id` | string | Yes |
| `workspace_role` | string | Yes |

**Valid Workspace Roles:** `workspace_user`, `workspace_developer`, `workspace_admin`

#### List Workspace Members
```
GET /v1/organizations/workspaces/{workspace_id}/members
```

#### Update Workspace Member Role
```
POST /v1/organizations/workspaces/{workspace_id}/members/{user_id}
```

| Parameter | Type | Required |
|-----------|------|----------|
| `workspace_role` | string | Yes |

#### Remove Workspace Member
```
DELETE /v1/organizations/workspaces/{workspace_id}/members/{user_id}
```

---

## 3. Usage Report API — Messages

### Endpoint
```
GET /v1/organizations/usage_report/messages
```

### Query Parameters

| Parameter | Type | Required | Options | Default |
|-----------|------|----------|---------|---------|
| `starting_at` | string (RFC 3339) | Yes | — | — |
| `ending_at` | string (RFC 3339) | No | — | — |
| `bucket_width` | string | No | `"1d"`, `"1h"`, `"1m"` | `"1d"` |
| `limit` | number | No | `"1d"`:7-31, `"1h"`:24-168, `"1m"`:60-1440 | 7/24/60 |
| `page` | string (cursor) | No | — | — |
| `group_by` | array | No | See below | — |
| `models` | array | No | — | — |
| `api_key_ids` | array | No | — | — |
| `workspace_ids` | array | No | — | — |
| `service_tiers` | array | No | See below | — |
| `context_window` | array | No | `"0-200k"`, `"200k-1M"` | — |
| `inference_geos` | array | No | `"global"`, `"us"`, `"not_available"` | — |
| `speeds` | array | No | `"standard"`, `"fast"` | — |

**Group By Options:**
- `api_key_id`
- `workspace_id`
- `model`
- `service_tier`
- `context_window`
- `inference_geo`
- `speed` (requires `fast-mode-2026-02-01` beta header)

**Service Tier Options:**
- `standard`
- `batch`
- `priority`
- `priority_on_demand`
- `flex`
- `flex_discount`

### Response Schema
```json
{
  "data": [
    {
      "starting_at": "string (RFC 3339)",
      "ending_at": "string (RFC 3339)",
      "results": [
        {
          "api_key_id": "string | null",
          "workspace_id": "string | null",
          "model": "string | null",
          "service_tier": "string | null",
          "context_window": "0-200k" | "200k-1M" | null,
          "inference_geo": "string | null",
          "speed": "standard" | "fast" | null,
          "uncached_input_tokens": number,
          "cache_read_input_tokens": number,
          "output_tokens": number,
          "cache_creation": {
            "ephemeral_1h_input_tokens": number,
            "ephemeral_5m_input_tokens": number
          },
          "server_tool_use": {
            "web_search_requests": number
          }
        }
      ]
    }
  ],
  "has_more": boolean,
  "next_page": "string (cursor)" | null
}
```

### Example Request
```bash
curl "https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=2025-03-01T00:00:00Z&bucket_width=1d&group_by=model&group_by=workspace_id" \
  --header "anthropic-version: 2023-06-01" \
  --header "x-api-key: sk-ant-admin-xxx"
```

### Features
- RFC 3339 timestamp support (snapped to minute/hour/day in UTC)
- Multiple grouping dimensions supported simultaneously
- Web search and cache metrics included
- Beta flag required for `speed` parameter: `anthropic-beta: fast-mode-2026-02-01`

---

## 4. Cost Report API

### Endpoint
```
GET /v1/organizations/cost_report
```

### Query Parameters

| Parameter | Type | Required | Options | Notes |
|-----------|------|----------|---------|-------|
| `starting_at` | string (RFC 3339) | Yes | — | Snapped to start of day in UTC |
| `ending_at` | string (RFC 3339) | No | — | Snapped to start of day in UTC |
| `bucket_width` | string | No | `"1d"` | Only option currently |
| `limit` | number | No | — | Max time buckets to return |
| `page` | string (cursor) | No | — | Pagination token |
| `group_by` | array | No | `"workspace_id"`, `"description"` | — |

### Response Schema
```json
{
  "data": [
    {
      "starting_at": "string (RFC 3339)",
      "ending_at": "string (RFC 3339)",
      "results": [
        {
          "amount": "string (decimal)",
          "currency": "USD",
          "cost_type": "tokens" | "web_search" | "code_execution" | null,
          "model": "string | null",
          "service_tier": "standard" | "batch" | null,
          "context_window": "0-200k" | "200k-1M" | null,
          "token_type": "uncached_input_tokens" | "output_tokens" | "cache_read_input_tokens" | "cache_creation.ephemeral_1h_input_tokens" | "cache_creation.ephemeral_5m_input_tokens" | null,
          "inference_geo": "string | null",
          "speed": "standard" | "fast" | null,
          "workspace_id": "string | null",
          "description": "string | null"
        }
      ]
    }
  ],
  "has_more": boolean,
  "next_page": "string (cursor)" | null
}
```

### Amount Format
- **Type:** Decimal string
- **Units:** Lowest currency units (e.g., cents for USD)
- **Example:** `"123.45"` in USD = $1.23

### Example Request
```bash
curl "https://api.anthropic.com/v1/organizations/cost_report?starting_at=2025-03-01T00:00:00Z&group_by=workspace_id&group_by=description" \
  --header "anthropic-version: 2023-06-01" \
  --header "x-api-key: sk-ant-admin-xxx"
```

### Features
- Tracks token costs, web search costs, code execution costs
- Breakdown by workspace and cost description
- Context window and service tier segmentation
- Cache creation costs separately tracked (ephemeral 1h, 5m)
- Speed tier tracking (requires beta header)

---

## 5. Organization Info API

### Endpoint
```
GET /v1/organizations/me
```

### Response Schema
```json
{
  "id": "string (UUID)",
  "type": "organization",
  "name": "string"
}
```

### Example Request
```bash
curl "https://api.anthropic.com/v1/organizations/me" \
  --header "anthropic-version: 2023-06-01" \
  --header "x-api-key: sk-ant-admin-xxx"
```

---

## Key Constraints & Notes

| Constraint | Details |
|-----------|---------|
| **Admin Role** | Only admin users can provision Admin API keys; admin users cannot be removed via API |
| **Invite Roles** | Cannot invite users with "admin" role; must be invited with lower role first |
| **Invite Expiry** | 21 days (non-modifiable) |
| **Date Format** | `starting_at` requires YYYY-MM-DD for Claude Code, RFC 3339 for other APIs |
| **Pagination** | All endpoints use opaque cursor tokens; set via `page` parameter, returned as `next_page` |
| **Cost Units** | Amount as decimal string in lowest currency units (cents for USD); currency always "USD" |
| **Beta Headers** | Speed filtering requires: `anthropic-beta: fast-mode-2026-02-01` |

---

## Rate Limiting & Defaults

- **Claude Code Analytics:** Single day query only; defaults 20 records/page, max 1000
- **Messages Usage:** Defaults vary by bucket_width (7d/24h/60m); max limits 31d/168h/1440m
- **Cost Report:** No specific documented limits
- **Member Management:** Standard API rate limits apply

---

## Common Headers

```
anthropic-version: 2023-06-01
x-api-key: sk-ant-admin-[admin-key]
anthropic-beta: fast-mode-2026-02-01  // optional, required for speed grouping
Content-Type: application/json         // for POST requests
```

---

## Sources

- [Claude Code Analytics API](https://platform.claude.com/docs/en/api/admin-api/claude-code/get-claude-code-usage-report)
- [Messages Usage Report API](https://platform.claude.com/docs/en/api/admin-api/usage-cost/get-messages-usage-report)
- [Cost Report API](https://platform.claude.com/docs/en/api/admin-api/usage-cost/get-cost-report)
- [Admin API Overview](https://platform.claude.com/docs/en/api/administration-api)
