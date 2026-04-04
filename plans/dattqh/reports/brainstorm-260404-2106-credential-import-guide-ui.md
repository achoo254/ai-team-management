# Brainstorm: Credential Import Guide UI

## Vấn đề
Dialog import credential (`seat-token-dialog.tsx`) không có hướng dẫn user lấy file `.credentials.json` ở đâu. User phải tự biết path — gây khó khăn cho người mới.

## Quyết định

### UI Layout: Help text + OS detect (Phương án D)
- Block nhỏ phía trên input tabs
- Detect OS từ `navigator.userAgent` / `navigator.platform`
- Highlight OS hiện tại, collapse OS khác
- Nút Copy path

### Credential Paths

| OS | Lưu trữ | Path |
|---|---|---|
| Windows | File | `C:\Users\{username}\.claude\.credentials.json` |
| Linux | File | `~/.claude/.credentials.json` |
| macOS | Keychain | Step-by-step guide (see below) |

Override: `$CLAUDE_CONFIG_DIR` env var thay đổi default path (Win/Linux).

### macOS Guide (step-by-step)
1. Mở **Keychain Access** (Spotlight → "Keychain")
2. Tìm kiếm "claude"
3. Double-click entry → tab "Attributes"
4. Click "Show password" → nhập password máy
5. Copy giá trị → paste vào dialog

### Ngôn ngữ: Mix Việt + English
- Text hướng dẫn: tiếng Việt
- Path, command, technical terms: English

## Implementation

### File cần sửa
- `packages/web/src/components/seat-token-dialog.tsx` — thêm help section

### Thay đổi cụ thể
1. Thêm helper function `detectOS()` → `'windows' | 'linux' | 'macos'`
2. Thêm component `CredentialPathGuide` phía trên Tabs
3. Dùng Collapsible (shadcn) cho mỗi OS entry
4. OS detect mặc định mở section phù hợp
5. Nút Copy dùng `navigator.clipboard.writeText()`

### UI mockup
```
┌─ 📁 Lấy credential từ đâu? ──────────────┐
│ ▾ Windows (OS hiện tại)                    │
│   Copy file:                               │
│   C:\Users\you\.claude\.credentials.json   │
│                                    [Copy]  │
│                                            │
│ ▸ Linux                                    │
│ ▸ macOS (Keychain)                         │
└────────────────────────────────────────────┘
```

Khi expand macOS:
```
│ ▾ macOS (Keychain)                         │
│   1. Mở Keychain Access (Spotlight)        │
│   2. Tìm "claude"                          │
│   3. Double-click → Show password          │
│   4. Nhập password máy → Copy giá trị      │
```

### Constraints
- Không tạo file mới — thêm trực tiếp vào `seat-token-dialog.tsx`
- Nếu file vượt 200 LOC → extract `CredentialPathGuide` ra file riêng
- Dùng shadcn Collapsible component (đã có trong project)

## Risks
- `navigator.userAgent` detection không 100% chính xác → fallback: hiện tất cả OS
- macOS Keychain steps có thể thay đổi theo version → ghi note "macOS 13+"
- File hiện tại 227 LOC → sau khi thêm sẽ vượt 200 → cần extract component

## Next Steps
- Implement theo plan nếu user approve
