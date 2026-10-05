# Phase 04 — Sửa test harness (phát sinh)

Phát hiện khi thêm test cho phase 01–03: `vitest.config.ts` dùng **allowlist thủ công** liệt kê
từng file `tests/api/*`, và `exclude` hẳn `tests/ui/**` + `tests/services/**`. Hệ quả: 11 file test
tồn tại trong repo nhưng **chưa từng chạy**.

## Kết quả

| | Trước | Sau |
|---|---|---|
| Test file chạy | 24 | **33** |
| Test chạy | 198 | **280** |

## Từng vấn đề

| # | Vấn đề | Xử lý |
|---|---|---|
| 1 | `bld-seat-stats-service.test.ts` mock `bld-metrics-service.js` — barrel đã tách ở phase 02 nên mock không còn chặn, test gọi thẳng mongoose và treo 40s | Mock lại `metrics-scope`/`seat-cost`/`cycle-utilization-service`; viết lại phần `topWaste` theo model chu kỳ |
| 2 | `anthropic-service.test.ts` mock `@/lib/config` nhưng service import `'../config.js'` → mock không bao giờ áp dụng, assertion đọc chuỗi rỗng | Mock đúng specifier service dùng |
| 3 | Alias `@/lib/config` chết vì `@/lib/` (web) đứng trước — Vite lấy alias khớp đầu tiên | Đưa alias cụ thể lên trước |
| 4 | UI test báo "Found multiple elements" — `globals: false` nên auto-cleanup của Testing Library không tự đăng ký, DOM tích luỹ qua các test | `afterEach(cleanup)` trong `tests/setup-jsdom.ts` |
| 5 | `app-sidebar.test.tsx` mock `react-router` nhưng mock không áp dụng cho dep node_modules → dùng `useLocation` thật, thiếu Router context | Bỏ mock, bọc `MemoryRouter` thật; thêm `react-router` vào devDeps root (test chạy từ root, pnpm strict không resolve được dep của `packages/web`) |
| 6 | `seat-card.test.tsx` thiếu 5 prop mới (`currentUserId`, `canManage`, `allUsers`, `onAssign`, `onExportCredential`) và không có QueryClient cho `WatchSeatButton` | Viết lại; thêm `title` cho 2 nút icon Sửa/Xoá — vốn **không có accessible name** (lỗi a11y thật) |
| 7 | `quota-forecast-bar.test.tsx` assert nhãn cũ ("Còn nhiều"/"Cao") | Cập nhật theo thang hiện tại; nhãn 5h nay xếp theo mức *tận dụng* (cao = tốt) |
| 8 | `app-sidebar` footer badge hiển thị `role`, test assert `team` | Sửa assertion, thêm test route active |
| 9 | `stat-cards.test.tsx` import component đã bị xoá từ commit e3078a2 | Xoá file mồ côi |
| 10 | `services/telegram-service.test.ts` test `sendWeeklyReport` — hàm không còn tồn tại trong source | Xoá file mồ côi |
| 11 | `alert-service.test.ts` mock `sendAlertToUser`/`sendPushToUser` trả `undefined`, service gọi `.catch()` lên đó | Mock resolve promise; đổi tên `alert-service.db.test.ts` |

## Lỗ hổng an toàn đã bịt

`tests/setup.ts` cũ đọc `process.env.MONGO_URI`, rồi `deleteMany({})` mọi collection sau **mỗi**
test và `dropDatabase()` khi kết thúc. Ai export `MONGO_URI` production vào shell rồi chạy
`pnpm test` sẽ **xoá sạch DB thật**.

`tests/helpers/db-helper.ts` mới gắn cứng vào `MongoMemoryServer` ephemeral và **không đọc
`MONGO_URI`** — không còn đường trỏ tới deployment thật.

## Cấu trúc mới

3 project chọn theo path, include bằng glob (không còn allowlist):

- `unit` (node) · `dom` (jsdom, `tests/ui|hooks`) · `db` (node + in-memory mongod, `**/*.db.test.ts`)

Hậu tố `.db.test.ts` **chính là đăng ký** — không có danh sách nào phải đồng bộ, nên test cần DB
không thể âm thầm chạy mà thiếu connection.

## Lint

`eslint.config.js` khai báo toàn bộ repo là `sourceType: "module"` nên `.cjs` hook báo
`'require' is not defined`; `argsIgnorePattern` cũng không phủ `catch (_)`. Thêm block riêng cho
`**/*.cjs` + mở rộng `varsIgnorePattern`/`caughtErrorsIgnorePattern`. `pnpm lint` giờ sạch.

## Dependency thêm mới

- `mongodb-memory-server` (devDep) — khôi phục đúng thứ `CLAUDE.md` đã mô tả nhưng chưa từng tồn tại
- `react-router` (devDep root) — để test UI resolve được từ thư mục root
