# Research Report: Lấy thêm dữ liệu sử dụng quota Claude Code

> Thực hiện: 2026-06-09 · Nguồn: Anthropic docs (platform.claude.com) + codebase hiện tại
> Fallback WebSearch (Gemini CLI không khả dụng trong môi trường bash, exit 1)

## Executive Summary

Tính năng trong ảnh ("What's contributing to your limits usage?") **KHÔNG lấy được qua bất kỳ API nào của Anthropic**. Chính dòng chú thích trong ảnh đã nói rõ: *"Approximate, based on local sessions on this machine"* — nó do binary Claude Code **tự tính cục bộ** từ file transcript phiên (`~/.claude/projects/**/*.jsonl`) trên máy, không có endpoint server.

TIN TỐT: codebase của bạn **đã có sẵn desktop agent webhook** (`webhook-ingest-service` + model `ClaudeSession`) đọc session cục bộ và gửi token counts về. Đây chính là nguồn duy nhất tái tạo được breakdown trong ảnh — chỉ cần mở rộng agent đó parse thêm vài field từ JSONL.

3 nguồn dữ liệu, mức khai thác hiện tại:

| Nguồn | Trạng thái trong code | Còn lấy thêm được? |
|-------|----------------------|--------------------|
| `/api/oauth/usage` (per-seat OAuth) | Đang dùng (collector) | **CÓ** — raw_response thật chứa 7 window + 2 sub-field extra_usage đang bị bỏ (xem §"Kết quả fetch thật") |
| `/v1/organizations/usage_report/claude_code` (Admin Analytics) | Client đã viết nhưng `ANTHROPIC_ADMIN_KEY` **trống** | ❌ **LOẠI BỎ** — không có admin key, không truy cập được |
| Local session JSONL (desktop agent) | Đang gửi token/model/cache | **Nguồn DUY NHẤT** cho breakdown trong ảnh (context >150k, subagent, per-skill) |

---

## ⭐ Kết quả fetch THẬT (2026-06-09, chỉ dùng OAuth token, 0 rủi ro block)

Phương pháp an toàn: usage đọc từ `raw_response` đã lưu trong DB (**0 API call**); profile gọi đúng 1 lần `/api/oauth/profile` (endpoint app vốn đã dùng). Không đụng admin key (không có). Không probe endpoint lạ.

### `/api/oauth/usage` — response thật có NHIỀU window hơn code đang trích

Code chỉ trích 4 window + extra_usage. Response thật (seat "TK Đạt"):

```jsonc
{
  "five_hour":           { "utilization": 3,  "resets_at": "..." },  // ✅ đang lưu
  "seven_day":           { "utilization": 62, "resets_at": "..." },  // ✅ đang lưu
  "seven_day_sonnet":    { "utilization": 21, "resets_at": "..." },  // ✅ đang lưu
  "seven_day_opus":      null,                                       // ✅ đang lưu
  "seven_day_oauth_apps": null,        // ❌ CHƯA trích — usage của OAuth apps
  "seven_day_cowork":     null,        // ❌ CHƯA trích — Claude "cowork"
  "seven_day_omelette":   null,        // ❌ codename nội bộ (null)
  "tangelo":              null,        // ❌ codename nội bộ (null)
  "iguana_necktie":       null,        // ❌ codename nội bộ (null)
  "omelette_promotional": null,        // ❌ codename nội bộ (null)
  "cinder_cove":          null,        // ❌ codename nội bộ (null)
  "extra_usage": {
    "is_enabled": false, "monthly_limit": null, "used_credits": null, "utilization": null,
    "currency": null,          // ❌ CHƯA trích
    "disabled_reason": null    // ❌ CHƯA trích
  }
}
```

→ Toàn bộ đã nằm trong `raw_response` (lưu sẵn). Trích thêm = chỉ thêm cột, **không cần gọi API mới**. Các codename (tangelo, cinder_cove...) là flag nội bộ Anthropic, đang null — **đừng build feature lên chúng** (YAGNI), giữ trong raw_response là đủ.

### `/api/oauth/profile` — response thật có ~14 field chưa cache

```jsonc
{
  "account": {
    "uuid": "...",                    // ❌ chưa cache
    "full_name": "...",               // ✅
    "display_name": "...",            // ✅
    "email": "dattqh@inet.vn",        // ❌ chưa cache (đã có seat.email)
    "has_claude_max": false,          // ✅
    "has_claude_pro": false,          // ✅
    "created_at": "2026-03-20T..."    // ❌ chưa cache — tuổi tài khoản
  },
  "organization": {
    "uuid": "...",                              // ❌
    "name": "iNET SOFTWARE COMPANY LIMITED",    // ✅
    "organization_type": "claude_team",         // ✅
    "billing_type": "stripe_subscription",      // ✅
    "rate_limit_tier": "default_claude_max_5x", // ✅
    "seat_tier": "team_tier_1",                 // ❌ CHƯA cache — hạng seat ⭐
    "has_extra_usage_enabled": false,           // ❌ CHƯA cache ⭐
    "subscription_status": "active",            // ✅
    "subscription_created_at": "2026-03-20T...",// ❌ chưa cache — tuổi sub
    "cc_onboarding_flags": {},                  // ❌ (rỗng)
    "claude_code_trial_ends_at": null,          // ❌ chưa cache — theo dõi trial
    "claude_code_trial_duration_days": null,    // ❌ chưa cache
    "payment_auth_hosted_invoice_url": null     // ❌ nhạy cảm, bỏ qua
  },
  "application": { "uuid": "...", "name": "Claude Code", "slug": "claude-code" }, // luôn = Claude Code
  "enabled_plugins": []                          // ❌ chưa cache — plugin bật
}
```

### Khuyến nghị field NÊN bổ sung (tất cả từ data đang về sẵn, 0 call mới)

| Field | Nguồn | Lý do |
|-------|-------|-------|
| `organization.seat_tier` | profile | Hạng seat (team_tier_1) — phân loại seat |
| `organization.has_extra_usage_enabled` | profile | Org có bật extra usage không |
| `organization.subscription_created_at` | profile | Tuổi subscription |
| `account.created_at` | profile | Tuổi tài khoản |
| `claude_code_trial_ends_at` + `_duration_days` | profile | Theo dõi trial sắp hết hạn |
| `enabled_plugins` | profile | Plugin đang bật |
| `extra_usage.currency` + `disabled_reason` | usage | Đơn vị tiền + lý do tắt extra usage |
| (window `seven_day_oauth_apps`, `seven_day_cowork`) | usage | Tuỳ chọn — đang null, trích khi cần |

**Bỏ qua (YAGNI/nhạy cảm):** các codename usage (tangelo, cinder_cove, omelette...), `cc_onboarding_flags`, `payment_auth_hosted_invoice_url`, `application.*`, `account.uuid`/`org.uuid` (trừ khi cần đối soát).

---

## Nguồn 1 — `/api/oauth/usage` (đang dùng ở `usage-collector-service.ts`)

Per-seat, auth bằng OAuth Bearer + header `anthropic-beta: oauth-2025-04-20`.

**Field trả về (bạn đã capture HẾT):**
- `five_hour` `{ utilization, resets_at }`
- `seven_day` `{ utilization, resets_at }`
- `seven_day_sonnet` `{ utilization, resets_at }`
- `seven_day_opus` `{ utilization, resets_at }`
- `extra_usage` `{ is_enabled, monthly_limit, used_credits, utilization }`

**Kết luận:** không còn field quan trọng nào sót. Endpoint này chỉ cho % quota theo cửa sổ thời gian — KHÔNG có token count, KHÔNG có breakdown theo skill/context. Cộng đồng có xin thêm "enterprise spending limit" (GitHub issue #34348) nhưng Anthropic chưa expose.

---

## Nguồn 2 — Admin Analytics API `/v1/organizations/usage_report/claude_code` ⭐ CƠ HỘI LỚN NHẤT

Auth bằng Admin key `x-api-key` (bạn đã có `ANTHROPIC_ADMIN_KEY` trong config). Hàm `getClaudeCodeUsage(date)` **đã viết sẵn ở `anthropic-service.ts:38` + có test đầy đủ — nhưng grep toàn repo: KHÔNG có route/cron/service nào gọi nó.** Tức là client đã sẵn sàng, chỉ thiếu wiring.

**Đặc tính:**
- Dữ liệu **tổng hợp theo NGÀY, theo từng user** (mỗi record = 1 user × 1 ngày). Param: `starting_at=YYYY-MM-DD` (1 ngày/lần), `limit` (max 1000), `page` (cursor).
- Trễ ~1h, không real-time.
- Bao gồm cả `customer_type: "subscription"` (Pro/Team) lẫn `"api"`.
- **Không** áp dụng cho usage qua AWS Bedrock / Vertex / MS Foundry.

**Field bạn CHƯA khai thác (rất nhiều):**

```
date, organization_id
actor: { type: user_actor, email_address }  ← map sang seat qua email!
customer_type        ("api" | "subscription")
terminal_type        ("vscode" | "iTerm.app" | "tmux" | ...)
core_metrics:
  num_sessions
  lines_of_code: { added, removed }
  commits_by_claude_code
  pull_requests_by_claude_code
tool_actions:        (accepted/rejected mỗi loại)
  edit_tool, multi_edit_tool, write_tool, notebook_edit_tool
model_breakdown[]:   (theo từng model)
  model               ("claude-opus-4-8" ...)
  tokens: { input, output, cache_read, cache_creation }
  estimated_cost: { currency: "USD", amount }   ← đơn vị: cents
```

**Giá trị thực tế:** đây là dữ liệu để dựng dashboard "năng suất + chi phí" cấp tổ chức — token & cost theo model, số dòng code, commit, PR, tỉ lệ accept/reject của từng tool. Match `actor.email_address` ↔ `seat.email` (bạn đã có pattern này ở `resolveSeatIdByEmail`) để gắn vào từng seat.

**Lưu ý:** "Admin API unavailable for individual accounts" — cần org account. Bạn dùng team nên OK.

---

## Nguồn 3 — Local session JSONL (chỉ qua desktop agent) ⭐ DUY NHẤT lấy được breakdown trong ảnh

Breakdown trong ảnh do Claude Code tính cục bộ từ transcript `~/.claude/projects/**/*.jsonl`. Mỗi dòng JSONL là 1 message, chứa: model, usage (input/output/cache tokens), context size, marker subagent, slash-command. Không có server API nào trả những con số này.

**Cách Claude Code suy ra từng chỉ số (để agent của bạn tái tạo):**

| Chỉ số trong ảnh | Cách tính từ JSONL |
|------------------|--------------------|
| `% usage at >150k context` | Mỗi request có tổng input+cache token = context size. Cộng usage (token-weighted) của các request có context > 150k / tổng. |
| `% từ subagent-heavy sessions` | JSONL đánh dấu message sidechain/subagent (field `isSidechain`). Cộng usage thuộc subagent / tổng. |
| `% theo từng skill/command` | Khi gọi slash-command (`/ck:debug`...), JSONL ghi lại lệnh. Quy token cost các message thuộc lệnh đó → bảng % theo skill. |

**Hiện trạng agent của bạn** (`webhook-schema.ts` → `ClaudeSession`): đã gửi `model, totalInputTokens, totalOutputTokens, totalCacheRead, totalCacheWrite, messageCount` per session. Để có breakdown trong ảnh cần **mở rộng agent parse thêm**:
- context size per message (để phân nhóm <50k / 50–150k / >150k)
- flag `isSidechain` → token subagent
- slash-command đầu mỗi đoạn → attribute token theo command/skill

Rồi thêm field vào `usageReportSchema` + `ClaudeSession` (hoặc collection mới `session_breakdown`).

---

## Khuyến nghị (ưu tiên giảm dần)

1. **Wire `getClaudeCodeUsage()` vào 1 cron ngày** + collection mới `claude_code_analytics` (key: email+date). Ít công nhất (client + test đã có), giá trị cao nhất: token/cost/model/LOC/commit/PR/tool-accept theo từng người. ROI cao nhất.
2. **Nếu thực sự cần đúng UI trong ảnh** (context buckets / subagent / per-skill): mở rộng desktop agent parse JSONL — đây là con đường DUY NHẤT, không có shortcut qua API.
3. `/api/oauth/usage`: giữ nguyên, không còn gì để thêm.

---

## Unresolved Questions

1. Format chính xác field `isSidechain` / slash-command trong JSONL của bản Claude Code bạn đang chạy cần verify trực tiếp bằng cách mở 1 file `~/.claude/projects/**/*.jsonl` (schema không công bố chính thức, có thể đổi giữa các version).
2. `estimated_cost.amount` — doc ghi "cents USD"; cần test 1 record thật để chắc đơn vị trước khi hiển thị tiền.
3. Admin Analytics có tính usage của OAuth seat (Max/Pro cá nhân add vào team) không, hay chỉ user thuộc org? Cần gọi thử 1 ngày thật để xác nhận coverage so với danh sách seat.

## Sources

- [Claude Code Analytics API — platform.claude.com](https://platform.claude.com/docs/en/api/claude-code-analytics-api)
- [Get Claude Code Usage Report (API reference)](https://docs.anthropic.com/en/api/admin-api/claude-code/get-claude-code-usage-report)
- [Usage and Cost API](https://platform.claude.com/docs/en/build-with-claude/usage-cost-api)
- [Anthropic OAuth Usage API — Issue #202 (Claude-Code-Usage-Monitor)](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/issues/202)
- [FEATURE: expose enterprise spending limit via /api/oauth/usage — Issue #34348](https://github.com/anthropics/claude-code/issues/34348)
- [Explore the context window — Claude Code Docs](https://code.claude.com/docs/en/context-window)
- [Models, usage, and limits in Claude Code — Help Center](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code)
