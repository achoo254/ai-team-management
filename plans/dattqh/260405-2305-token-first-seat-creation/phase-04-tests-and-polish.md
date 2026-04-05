# Phase 4: Integration Tests + Polish

**Priority:** Medium | **Status:** pending | **Depends:** Phase 1-3

## Goal

E2E integration testing, error UX polish, docs update.

## Tasks

### 4.1 E2E happy path test (manual QA)

- Copy real credential JSON từ `~/.claude/.credentials.json` của 1 seat
- Paste vào form create → verify preview shows correct email/org
- Submit → verify seat appears in list with correct email/label
- Verify `last_fetched_at` updates sau ~5min (cron collector runs)

### 4.2 E2E edge cases

- Paste expired token → preview shows expired red, submit blocked
- Paste token of existing seat → duplicate error shown
- Toggle manual mode with invalid email → submit blocked
- Network offline during profile preview → error banner + manual mode offer

### 4.3 UX polish

**Loading states:**
- Textarea has paste → spinner "Parsing..."
- Valid parse → spinner "Fetching profile..."
- Profile loaded → green checkmark on fields

**Error messages (Vietnamese):**
- Invalid JSON: "JSON không hợp lệ hoặc thiếu access_token"
- Profile 401: "Token không hợp lệ hoặc đã hết hạn"
- Profile timeout/5xx: "Không kết nối được Claude API. Thử lại hoặc dùng chế độ nhập thủ công?"
- Duplicate: "Seat với email `{email}` đã tồn tại. Vui lòng dùng chức năng Update Token."

**Accessibility:**
- Dialog has proper ARIA labels
- Error messages use `role="alert"`
- Tab order: textarea → label → max_users → buttons

### 4.4 Docs update

**Update `CLAUDE.md` nếu cần:**
- Không cần thay đổi Auth Flow section
- Update Key Domain Rules nếu mention seat creation flow

**Update README hoặc `docs/codebase-summary.md`:**
- Note new token-first creation flow
- Reference `parseCredentialJson` as shared helper

### 4.5 Migration note

**Không cần migration DB** — Seat model không đổi.

**Deployment note:** Sau khi deploy BE, FE phải deploy cùng (breaking change: old FE gọi create với old payload → 400). Coordinate release.

## Files

**Update docs (if needed):**
- `CLAUDE.md`
- `docs/codebase-summary.md`

**Manual QA checklist** (document in plan, no files).

## Success Criteria

- [ ] All happy path + edge case QA scenarios pass
- [ ] Error messages friendly in Vietnamese
- [ ] Loading states smooth (no flashing)
- [ ] Dialog accessible (tab nav + screen reader)
- [ ] Docs reflect new flow
- [ ] BE + FE deployed together (no version skew)

## Unresolved Questions

Không.
