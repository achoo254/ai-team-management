# Phase 2 — Frontend: Settings UI Cleanup

## Context
- Brainstorm: `../reports/brainstorm-260410-0904-usage-report-per-cycle.md`
- Phase 1 phải xong trước (DTO đã đổi)
- Card "Báo cáo Usage tự động" trong settings page

## Priority
MEDIUM

## Status
completed

## Key insights
- UI hiện có: toggle "Đang bật" + chips ngày (CN-T7) + dropdown giờ + nút Lưu + nút "Gửi thử"
- Sau migration: chỉ còn toggle + helper text + nút "Gửi thử"
- Nút Lưu có thể gộp với toggle (toggle = autosave) hoặc giữ nếu component pattern

## Requirements
- Bỏ chips chọn ngày (CN-T7)
- Bỏ dropdown chọn giờ
- Giữ toggle "Đang bật"
- Giữ nút "Gửi thử"
- Thêm helper text dưới title: *"Báo cáo tự gửi trước khi mỗi seat reset chu kỳ 7 ngày (gom trong cửa sổ 6 giờ)."*
- Form state + mutation chỉ submit `report_enabled`

## Related code files

**Find first** (chưa scout exact path):
- `packages/web/src/pages/settings.tsx` — settings page
- HOẶC `packages/web/src/components/notification-settings-card.tsx` (nếu tách component)
- `packages/web/src/hooks/use-user-settings.ts` — React Query hook
- `packages/shared/types.ts` — DTO (đã update Phase 1)

**Modify:**
- Component card "Báo cáo Usage tự động"
- Mutation payload trong hook (bỏ `report_days`, `report_hour`)

## Implementation steps

1. Grep `report_days` + `report_hour` trong `packages/web/` để locate component
2. Xoá form fields ngày + giờ
3. Xoá state liên quan (useState/form schema)
4. Update mutation gọi API: payload chỉ có `{ report_enabled }`
5. Thêm helper text dưới title
6. Verify nút "Gửi thử" vẫn gọi đúng endpoint cũ
7. Run `pnpm -F @repo/web build` typecheck

## Todo list

- [x] Locate component file
- [x] Remove ngày chips
- [x] Remove giờ dropdown
- [x] Remove form state cho 2 fields
- [x] Update mutation payload
- [x] Add helper text
- [x] Verify "Gửi thử" hoạt động
- [x] `pnpm -F @repo/web build` pass

## Success criteria
- UI card chỉ còn: title + helper text + toggle + Gửi thử
- Toggle on/off save thành công
- "Gửi thử" gọi `/api/user-settings/test-report` (hoặc endpoint hiện tại) → user nhận message Telegram
- Typecheck pass

## Risks
- **R1**: nếu form dùng schema validator (Zod/RHF) — phải update cả schema
- **R2**: nếu component có translation keys, có thể có dead keys → có thể cleanup sau

## Security
- Không touch auth/crypto

## Next
→ Phase 3 (Tests + verify)
