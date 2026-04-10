---
phase: 2
name: Devices management UI
status: completed
priority: P1
---

# Phase 2 — Devices management UI

## Context Links
- BE routes (đã xong): `packages/api/src/routes/devices.ts`
  - `POST /api/devices` → `{ device, api_key }` (plaintext 1 lần)
  - `GET /api/devices` → `{ devices }` (không key)
  - `DELETE /api/devices/:id` → soft revoke
- Service: `packages/api/src/services/device-service.ts`

## Overview
**Priority:** P1
**Description:** User tự tạo device, nhận `api_key` một lần, revoke khi cần. Gắn vào trang Settings hiện có.

## Key Insights
- Backend đã sẵn sàng hoàn toàn, chỉ thiếu FE.
- `api_key` plaintext chỉ trả 1 lần khi POST → UI phải surface rõ ràng với copy button + warning.
- Desktop app cần biết: endpoint (`{WEB_URL}/api/webhook/usage-report`), `device_id`, `api_key`, HMAC algorithm. Hiển thị hướng dẫn inline trong modal create.

## Requirements

### Functional
1. Section "Desktop Devices" trong `pages/settings.tsx`.
2. List devices hiện tại (device_name, hostname, last_seen_at, status, created_at). Status derive từ `revoked_at`.
3. Button "Add Device" → dialog form: `device_name`, `hostname`.
4. Sau khi tạo thành công: hiển thị raw `api_key` trong dialog riêng (hoặc cùng dialog step 2) với:
   - Warning: "Key sẽ không hiển thị lại. Copy ngay."
   - Copy button.
   - Hướng dẫn config desktop app (endpoint URL, paste device_id + api_key vào đâu, HMAC algorithm spec).
5. Button "Revoke" trên mỗi row với confirm dialog.
6. Loading/error states qua React Query mutations.
7. Toast notifications thành công/thất bại.

### Non-functional
- Dùng shadcn/ui components có sẵn (`Dialog`, `Button`, `Table`, `Input`, `Badge`).
- Mobile responsive (table → card layout < 640px).
- File size < 200 LOC mỗi file.

## Architecture

```
packages/web/src/
├─ pages/settings.tsx                          // ADD: <DevicesSection />
├─ components/
│  ├─ devices-section.tsx                      // NEW: wrapper (list + add button)
│  ├─ devices-table.tsx                        // NEW: table rows với revoke action
│  ├─ create-device-dialog.tsx                 // NEW: 2-step dialog (form → api_key reveal)
│  └─ device-api-key-reveal.tsx                // NEW: component hiển thị key + copy + hướng dẫn
├─ hooks/use-devices.ts                        // NEW: React Query hooks
└─ lib/api-client.ts                           // EXTEND: devicesApi methods
```

## Related Code Files

### Modify
- `packages/web/src/pages/settings.tsx` — thêm `<DevicesSection />` section
- `packages/web/src/lib/api-client.ts` — thêm `devicesApi.list/create/revoke`

### Create
- `packages/web/src/components/devices-section.tsx`
- `packages/web/src/components/devices-table.tsx`
- `packages/web/src/components/create-device-dialog.tsx`
- `packages/web/src/components/device-api-key-reveal.tsx`
- `packages/web/src/hooks/use-devices.ts`

### Read for context
- `packages/web/src/pages/settings.tsx` — hiện đang có gì
- `packages/web/src/components/ui/dialog.tsx` — pattern dialog
- `packages/web/src/hooks/use-seats.ts` — pattern React Query existing
- `packages/api/src/models/device.ts` — hiểu shape

## Implementation Steps

1. **Extend API client** (`lib/api-client.ts`)
   - `devicesApi.list() → Promise<{ devices: Device[] }>`
   - `devicesApi.create({ device_name, hostname }) → Promise<{ device, api_key }>`
   - `devicesApi.revoke(id) → Promise<{ device }>`

2. **Hook `use-devices.ts`**
   - `useDevices()` — `useQuery(['devices'], devicesApi.list)`
   - `useCreateDevice()` — `useMutation` invalidate `['devices']` on success, return raw api_key để UI hiển thị
   - `useRevokeDevice()` — `useMutation` invalidate `['devices']`

3. **Component `device-api-key-reveal.tsx`**
   - Props: `{ apiKey: string, deviceId: string, webhookUrl: string }`
   - Warning banner đỏ
   - Input readonly + copy button cho `api_key`
   - Input readonly + copy button cho `device_id`
   - Hướng dẫn text: cách config trong desktop app (endpoint, headers, HMAC-SHA256 algorithm, body format)

4. **Component `create-device-dialog.tsx`**
   - Dialog controlled state: `step: 'form' | 'reveal'`
   - Step 1: form `device_name` + `hostname`, submit call `useCreateDevice`
   - Step 2: hiển thị `<DeviceApiKeyReveal />` với data từ mutation result
   - Close dialog reset state

5. **Component `devices-table.tsx`**
   - Table columns: Name, Hostname, Status, Last seen, Created, Actions
   - Status badge: "Active" (green) nếu `!revoked_at`, "Revoked" (gray)
   - Last seen relative time via `formatDistanceToNow`
   - Action column: "Revoke" button với AlertDialog confirm
   - Mobile: flex-col card layout

6. **Component `devices-section.tsx`**
   - Header: "Desktop Devices" + description + "Add Device" button
   - Body: `useDevices()` → `<DevicesTable />` or empty state
   - Empty state: call-to-action text khuyến khích tạo device đầu tiên

7. **Mount vào `pages/settings.tsx`**
   - Import `<DevicesSection />` và render trong settings layout

8. **Smoke test manual**
   - Create device → thấy api_key → copy → dán vào desktop app → gửi webhook thành công
   - Revoke device → webhook từ device đó trả 401

## Todo List

- [x] Extend `api-client.ts` với `devicesApi`
- [x] Hook `use-devices.ts` (list/create/revoke)
- [x] Component `device-api-key-reveal.tsx`
- [x] Component `create-device-dialog.tsx` (2-step)
- [x] Component `devices-table.tsx` (với revoke confirm)
- [x] Component `devices-section.tsx` (wrapper)
- [x] Mount vào `pages/settings.tsx`
- [x] Manual smoke test: create → config desktop → webhook OK → revoke → 401
- [x] `pnpm build` pass
- [x] `pnpm lint` pass

## Success Criteria
- User có thể tạo device + copy api_key trong 1 phút.
- Revoke device xong, desktop gửi webhook bị BE reject 401.
- UI responsive mobile.
- Không file nào > 200 LOC.

## Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| User đóng dialog trước khi copy key → mất key vĩnh viễn | UX | Warning đỏ rõ ràng + confirm trước khi close step 2 + chỉ cho đóng bằng button "Tôi đã copy" |
| User quên hướng dẫn config desktop | Support overhead | Hiển thị endpoint + device_id + api_key + 1 đoạn code mẫu JSON trong reveal component |
| Race condition nếu user spam "Revoke" | None | React Query mutation handle |

## Security Considerations
- `api_key` chỉ tồn tại trong React state → không lưu localStorage.
- Không log `api_key` ra console.
- Revoke dùng DELETE `/api/devices/:id` yêu cầu JWT → BE check ownership.

## Next Steps
- Phase 3 song song hoặc tuần tự.
